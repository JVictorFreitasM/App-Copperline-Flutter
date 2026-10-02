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
          // Pedido criado localmente (POST /pedidos) so' tem vendedorId
          // (vendedor), nunca vendedorRadarId (so' preenchido depois que o
          // sync trouxer de volta do Radar - pode nunca acontecer, ver
          // achado de 2026-09-28). Sem isso, a listagem mostrava "—" no
          // nome do vendedor de todo pedido recem-criado - paraPedidoResumoDto
          // agora tenta os dois.
          vendedor: true,
          solicitacoesDesconto: { where: { status: 'PENDENTE' }, take: 1 },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        // Desempate por sincronizadoEm (2026-09-25, bug real: pedido
        // criado localmente por POST /pedidos fica com dataHoraUltimaAlteracao
        // null ate' o proximo sync trazer de volta do Radar - SEM
        // desempate, o Postgres nao garante ordem nenhuma entre as
        // dezenas de milhares de linhas empatadas em null, entao um
        // pedido acabado de criar cai numa posicao arbitraria da
        // paginacao em vez de aparecer no topo. sincronizadoEm NUNCA e'
        // null (preenchido na criacao E em todo upsert de sync).
        orderBy: [{ dataHoraUltimaAlteracao: 'desc' }, { sincronizadoEm: 'desc' }],
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
  // statusAprovacao, sem paginacao (so a contagem). `orcamentos` (Epico 4)
  // acrescentado sem quebrar os 2 campos ja existentes.
  async contarPorStatusAprovacao(
    escopo: EscopoClientes,
  ): Promise<{ naoIntegrados: number; aguardandoAprovacao: number; orcamentos: number }> {
    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    if (whereEscopo === null) {
      return { naoIntegrados: 0, aguardandoAprovacao: 0, orcamentos: 0 };
    }

    const [naoIntegrados, aguardandoAprovacao, orcamentos] = await this.prisma.$transaction([
      this.prisma.pedido.count({
        where: mesclarWhereEscopo(whereEscopo, whereStatusAprovacao('NAO_INTEGRADO')),
      }),
      this.prisma.pedido.count({
        where: mesclarWhereEscopo(whereEscopo, whereStatusAprovacao('AGUARDANDO_APROVACAO')),
      }),
      this.prisma.pedido.count({
        where: mesclarWhereEscopo(whereEscopo, whereStatusAprovacao('ORCAMENTO')),
      }),
    ]);

    return { naoIntegrados, aguardandoAprovacao, orcamentos };
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

  // A decisao (aceitar/recusar) do desconto por item mudou pra
  // DecisaoDescontoPedidoService - com validacao de alcada. Os metodos antigos
  // daqui (aprovarItem/rejeitarItem/aprovarTodosItens/rejeitarTodosItens) nao
  // checavam papel nenhum e foram removidos.

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
// NAO_INTEGRADO exclui ORCAMENTO explicitamente (Epico 4) - antes do
// orcamento virar um status real, "idExternoErp null" cobria as duas
// coisas misturadas; agora orcamento tem bucket proprio.
function whereStatusAprovacao(
  valor: 'NAO_INTEGRADO' | 'AGUARDANDO_APROVACAO' | 'ENVIADO' | 'ORCAMENTO' | 'CANCELADO',
): Prisma.PedidoWhereInput {
  switch (valor) {
    case 'NAO_INTEGRADO':
      return { idExternoErp: null, statusLocal: { notIn: ['ORCAMENTO', 'CANCELADO'] } };
    case 'AGUARDANDO_APROVACAO':
      return { statusLocal: 'AGUARDANDO_APROVACAO' };
    case 'ENVIADO':
      return { OR: [{ statusLocal: 'ENVIADO' }, { idExternoErp: { not: null } }] };
    case 'ORCAMENTO':
      return { statusLocal: 'ORCAMENTO' };
    case 'CANCELADO':
      return { statusLocal: 'CANCELADO' };
  }
}
