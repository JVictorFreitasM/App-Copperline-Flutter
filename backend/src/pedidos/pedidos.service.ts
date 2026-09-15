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
import { PEDIDO_DETALHE_INCLUDE } from './pedido-detalhe.include';
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

    const where = construirWhereListagem(query, whereEscopo);

    const [pedidos, total] = await this.prisma.$transaction([
      this.prisma.pedido.findMany({
        where,
        include: {
          cliente: true,
          vendedorRadar: true,
          solicitacoesDesconto: { where: { status: 'PENDENTE' }, take: 1 },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { dataHoraUltimaAlteracao: 'desc' },
      }),
      this.prisma.pedido.count({ where }),
    ]);

    return paginar(
      pedidos.map((pedido) =>
        paraPedidoResumoDto(pedido, pedido.solicitacoesDesconto.length > 0),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  // Contadores dos atalhos rapidos da listagem (layout de referencia:
  // "Nao integrados (N)" / "Aguardando aprovacao (N)") - mesmos buckets de
  // statusAprovacao, sem paginacao (so a contagem).
  async contarPorStatusAprovacao(
    escopo: EscopoClientes,
  ): Promise<{ naoIntegrados: number; aguardandoAprovacao: number }> {
    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    if (whereEscopo === null) {
      return { naoIntegrados: 0, aguardandoAprovacao: 0 };
    }

    const [naoIntegrados, aguardandoAprovacao] = await this.prisma.$transaction([
      this.prisma.pedido.count({
        where: mesclarWhereEscopo(whereEscopo, whereStatusAprovacao('NAO_INTEGRADO')),
      }),
      this.prisma.pedido.count({
        where: mesclarWhereEscopo(whereEscopo, whereStatusAprovacao('AGUARDANDO_APROVACAO')),
      }),
    ]);

    return { naoIntegrados, aguardandoAprovacao };
  }

  async buscarPorId(id: string, escopo: EscopoClientes): Promise<PedidoDetalheDto> {
    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Pedido '${id}' não encontrado`);
    }

    const pedido = await this.prisma.pedido.findFirst({
      where: { id, ...whereEscopo },
      include: PEDIDO_DETALHE_INCLUDE,
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido '${id}' não encontrado`);
    }

    return paraPedidoDetalheDto(pedido);
  }

  // Revisao por item (tela de detalhe do pedido, layout de referencia
  // ref1.jpeg) - ver comentario do enum StatusAprovacaoItemPedido no
  // schema.prisma. Mesma checagem de escopo de buscarPorId (findFirst com
  // whereEscopo) antes de decidir qualquer item - sem isso um vendedor
  // comum poderia aprovar/rejeitar item de pedido de outra carteira (IDOR).
  async aprovarItem(
    pedidoId: string,
    itemId: string,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<PedidoDetalheDto> {
    return this.decidirItem(pedidoId, itemId, 'APROVADO', usuarioId, escopo);
  }

  async rejeitarItem(
    pedidoId: string,
    itemId: string,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<PedidoDetalheDto> {
    return this.decidirItem(pedidoId, itemId, 'REJEITADO', usuarioId, escopo);
  }

  async aprovarTodosItens(
    pedidoId: string,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<PedidoDetalheDto> {
    return this.decidirTodosItens(pedidoId, 'APROVADO', usuarioId, escopo);
  }

  async rejeitarTodosItens(
    pedidoId: string,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<PedidoDetalheDto> {
    return this.decidirTodosItens(pedidoId, 'REJEITADO', usuarioId, escopo);
  }

  private async decidirItem(
    pedidoId: string,
    itemId: string,
    status: 'APROVADO' | 'REJEITADO',
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<PedidoDetalheDto> {
    await this.confirmarPedidoNoEscopo(pedidoId, escopo);

    const resultado = await this.prisma.pedidoItem.updateMany({
      where: { id: itemId, pedidoId },
      data: { statusAprovacao: status, decididoPorId: usuarioId, decididoEm: new Date() },
    });
    if (resultado.count === 0) {
      throw new NotFoundException(
        `Item '${itemId}' não encontrado no pedido '${pedidoId}'`,
      );
    }

    return this.buscarPorId(pedidoId, escopo);
  }

  private async decidirTodosItens(
    pedidoId: string,
    status: 'APROVADO' | 'REJEITADO',
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<PedidoDetalheDto> {
    await this.confirmarPedidoNoEscopo(pedidoId, escopo);

    await this.prisma.pedidoItem.updateMany({
      where: { pedidoId },
      data: { statusAprovacao: status, decididoPorId: usuarioId, decididoEm: new Date() },
    });

    return this.buscarPorId(pedidoId, escopo);
  }

  // So confirma que o pedido existe DENTRO do escopo (mesmo 404 de
  // buscarPorId pra fora do escopo, nunca 403 - nao vaza a existencia de
  // pedido de outra carteira) - reaproveitado por decidirItem/
  // decidirTodosItens antes de qualquer escrita.
  private async confirmarPedidoNoEscopo(
    pedidoId: string,
    escopo: EscopoClientes,
  ): Promise<void> {
    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Pedido '${pedidoId}' não encontrado`);
    }

    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, ...whereEscopo },
      select: { id: true },
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido '${pedidoId}' não encontrado`);
    }
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

// Monta o where combinando escopo + todos os filtros da listagem via `AND`
// (array), nunca spread num unico objeto - achado desta rodada: escopo
// EQUIPE/PROPRIO e o filtro clienteNome usam a MESMA chave de nivel
// superior (`cliente: {...}`); um spread `{...whereEscopo, ...{cliente:
// {OR:[...]}}}` faz a segunda ocorrencia SOBRESCREVER a primeira,
// descartando silenciosamente a restricao de escopo (IDOR: vendedor comum
// buscando por nome de cliente enxergaria pedido de qualquer carteira).
// `AND: [...]` evita a colisao porque cada condicao fica em seu proprio
// item do array, mesmo repetindo a chave `cliente` em mais de uma.
function construirWhereListagem(
  query: ListarPedidosQueryDto,
  whereEscopo: Prisma.PedidoWhereInput,
): Prisma.PedidoWhereInput {
  const condicoes: Prisma.PedidoWhereInput[] = [whereEscopo];

  if (query.clienteId) {
    condicoes.push({ clienteId: query.clienteId });
  }
  if (query.clienteNome) {
    condicoes.push({
      cliente: {
        OR: [
          { razaoSocial: { contains: query.clienteNome, mode: 'insensitive' } },
          { nomeFantasia: { contains: query.clienteNome, mode: 'insensitive' } },
        ],
      },
    });
  }
  if (query.situacao) {
    condicoes.push({ situacao: query.situacao });
  }
  if (query.dataInicial || query.dataFinal) {
    condicoes.push({
      dataHoraUltimaAlteracao: {
        ...(query.dataInicial && { gte: new Date(query.dataInicial) }),
        // Fim do dia - dataFinal chega como data pura (YYYY-MM-DD), sem
        // isso o filtro excluiria qualquer pedido alterado depois da
        // meia-noite do proprio dia final.
        ...(query.dataFinal && { lte: new Date(`${query.dataFinal}T23:59:59.999Z`) }),
      },
    });
  }
  // "Equipe" (layout de referencia) - filtra por um vendedor especifico
  // DENTRO do escopo (ver comentario da DTO): um vendedorId fora do
  // escopo do usuario logado nao bate com whereEscopo, entao o AND todo
  // simplesmente nao retorna nada - sem checagem especial de IDOR aqui,
  // a combinacao dos dois `AND` ja garante isso.
  if (query.vendedorId) {
    condicoes.push({
      cliente: { vendedores: { some: { vendedorId: query.vendedorId } } },
    });
  }
  if (query.statusAprovacao) {
    condicoes.push(whereStatusAprovacao(query.statusAprovacao));
  }
  if (query.ufEntrega) {
    condicoes.push({ ufEntrega: query.ufEntrega.toUpperCase() });
  }

  return { AND: condicoes };
}

function mesclarWhereEscopo(
  whereEscopo: Prisma.PedidoWhereInput,
  extra: Prisma.PedidoWhereInput,
): Prisma.PedidoWhereInput {
  return { AND: [whereEscopo, extra] };
}

// Bucket derivado do fluxo local de criacao - ver comentario na DTO
// (listar-pedidos-query.dto.ts) pra semantica completa de cada valor.
function whereStatusAprovacao(
  valor: 'NAO_INTEGRADO' | 'AGUARDANDO_APROVACAO' | 'ENVIADO',
): Prisma.PedidoWhereInput {
  switch (valor) {
    case 'NAO_INTEGRADO':
      return { idExternoErp: null };
    case 'AGUARDANDO_APROVACAO':
      return { statusLocal: 'AGUARDANDO_APROVACAO' };
    case 'ENVIADO':
      return { OR: [{ statusLocal: 'ENVIADO' }, { idExternoErp: { not: null } }] };
  }
}
