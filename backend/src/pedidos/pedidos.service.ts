import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraPedidoDetalheDto,
  paraPedidoResumoDto,
  type PedidoDetalheDto,
  type PedidoResumoDto,
} from './dto/pedido-response.dto';
import type { ListarPedidosQueryDto } from './dto/listar-pedidos-query.dto';

// So leitura sobre dado ja sincronizado do WK Radar (OS 07) - sem regra de
// negocio, entao sem entidade de dominio separada (ver skill nest-endpoint,
// criterio de DDD).
@Injectable()
export class PedidosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarPedidosQueryDto,
  ): Promise<PaginatedResult<PedidoResumoDto>> {
    const where: Prisma.PedidoWhereInput = {
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

  async buscarPorId(id: string): Promise<PedidoDetalheDto> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
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
}
