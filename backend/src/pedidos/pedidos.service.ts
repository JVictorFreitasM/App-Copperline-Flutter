import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { construirWherePedidoPorEscopo } from '../vendedores/vendedor-escopo.service';
import {
  paraPedidoDetalheDto,
  paraPedidoResumoDto,
  type PedidoDetalheDto,
  type PedidoResumoDto,
} from './dto/pedido-response.dto';
import {
  paraPedidoHistoricoStatusDto,
  type PedidoHistoricoStatusDto,
} from './dto/pedido-historico.dto';
import type { ListarPedidosQueryDto } from './dto/listar-pedidos-query.dto';

// So leitura sobre dado ja sincronizado do WK Radar (OS 07) - sem regra de
// negocio, entao sem entidade de dominio separada (ver skill nest-endpoint,
// criterio de DDD). Todo metodo publico recebe EscopoClientes (achado
// critico da auditoria de seguranca: sem esse filtro, qualquer usuario
// autenticado enxergava pedido de qualquer cliente - ver
// vendedor-escopo.service.ts).
@Injectable()
export class PedidosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarPedidosQueryDto,
    escopo: EscopoClientes,
  ): Promise<PaginatedResult<PedidoResumoDto>> {
    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    if (whereEscopo === null) {
      return paginar([], 0, query.page, query.limit);
    }

    const where: Prisma.PedidoWhereInput = {
      ...whereEscopo,
      ...(query.clienteId && { clienteId: query.clienteId }),
      ...(query.clienteNome && {
        cliente: {
          OR: [
            {
              razaoSocial: { contains: query.clienteNome, mode: 'insensitive' },
            },
            {
              nomeFantasia: {
                contains: query.clienteNome,
                mode: 'insensitive',
              },
            },
          ],
        },
      }),
      ...(query.situacao && { situacao: query.situacao }),
      ...((query.dataInicial || query.dataFinal) && {
        dataHoraUltimaAlteracao: {
          ...(query.dataInicial && { gte: new Date(query.dataInicial) }),
          // Fim do dia - dataFinal chega como data pura (YYYY-MM-DD), sem
          // isso o filtro excluiria qualquer pedido alterado depois da
          // meia-noite do proprio dia final.
          ...(query.dataFinal && {
            lte: new Date(`${query.dataFinal}T23:59:59.999Z`),
          }),
        },
      }),
    };

    const [pedidos, total] = await this.prisma.$transaction([
      this.prisma.pedido.findMany({
        where,
        include: { cliente: true },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { dataHoraUltimaAlteracao: 'desc' },
      }),
      this.prisma.pedido.count({ where }),
    ]);

    return paginar(
      pedidos.map(paraPedidoResumoDto),
      total,
      query.page,
      query.limit,
    );
  }

  async buscarPorId(id: string, escopo: EscopoClientes): Promise<PedidoDetalheDto> {
    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Pedido '${id}' não encontrado`);
    }

    const pedido = await this.prisma.pedido.findFirst({
      where: { id, ...whereEscopo },
      include: {
        cliente: true,
        itens: { include: { produto: true }, orderBy: { numero: 'asc' } },
      },
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido '${id}' não encontrado`);
    }

    return paraPedidoDetalheDto(pedido);
  }

  // GET /pedidos/:id/historico (OS-BACKEND-33) - ordem cronologica
  // (criterio de aceite).
  async obterHistorico(
    id: string,
    escopo: EscopoClientes,
  ): Promise<PedidoHistoricoStatusDto[]> {
    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Pedido '${id}' não encontrado`);
    }

    const pedido = await this.prisma.pedido.findFirst({
      where: { id, ...whereEscopo },
      select: { id: true },
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido '${id}' não encontrado`);
    }

    const historico = await this.prisma.pedidoHistoricoStatus.findMany({
      where: { pedidoId: id },
      include: { usuario: true },
      orderBy: { alteradoEm: 'asc' },
    });

    return historico.map(paraPedidoHistoricoStatusDto);
  }
}
