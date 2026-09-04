import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EstoqueConsultaDto } from './dto/estoque-response.dto';
import type { ProdutoMaisPedidoDto } from './dto/estoque-mais-pedidos.dto';

// So leitura sobre dado ja sincronizado (validacao do produto + saldo, ver
// SaldoEstoqueSyncStrategy) - sem regra de negocio nossa, sem entidade de
// dominio (ver skill nest-endpoint, criterio de DDD). Ate a sincronizacao
// de saldo de estoque, este service consultava o WK BI (Executivo.svc) em
// tempo real a cada requisicao - trocado por leitura da tabela local
// (SaldoEstoque) pra eliminar a dependencia sincrona do servico legado a
// cada consulta do app comercial. A validacao de existencia do produto
// abaixo NAO mudou nesta troca (pedido explicito da OS de sync de saldo).
@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  async consultarPorIdentificador(
    identificador: string,
  ): Promise<EstoqueConsultaDto> {
    const produto = await this.prisma.produto.findFirst({
      where: {
        OR: [{ idExternoErp: identificador }, { codigo: identificador }],
      },
    });

    if (!produto) {
      throw new NotFoundException(`Produto '${identificador}' não encontrado`);
    }

    if (!produto.codigo) {
      // Caso raro: stub incompleto criado por PedidoSyncStrategy (OS 07)
      // ainda sem codigo real - Estoque.svc so identifica produto por
      // CodigoProduto, sem ele nao ha o que buscar.
      throw new NotFoundException(
        `Produto '${identificador}' ainda não possui código sincronizado`,
      );
    }

    const saldo = await this.prisma.saldoEstoque.findUnique({
      where: { codigoProduto: produto.codigo },
    });

    if (!saldo) {
      // Produto existe mas nunca teve saldo sincronizado (fora do filtro
      // Estoque Proprio, ou a sincronizacao ainda nao rodou pra ele) -
      // itens vazio, nao erro (mesmo contrato ja usado pra "sem saldo").
      return { produtoId: produto.id, codigo: produto.codigo, itens: [], atualizadoEm: null };
    }

    return {
      produtoId: produto.id,
      codigo: produto.codigo,
      itens: [
        {
          localCodigo: null,
          localNome: null,
          lote: null,
          fabricadoEm: null,
          quantidade: saldo.quantidadeDisponivel.toString(),
        },
      ],
      atualizadoEm: saldo.atualizadoEm.toISOString(),
    };
  }

  // Top produtos mais pedidos (pedido do usuario: "estoque deve mostrar os
  // 10 produtos mais comprados/feito pedido") - ranking por QUANTIDADE
  // total pedida (soma de PedidoItem.quantidadeVenda), nao por valor - o
  // objetivo aqui e' priorizar reposicao de estoque, nao faturamento (isso
  // ja existe em GET /dashboard/ranking, topProdutos). Sem filtro de
  // periodo (ao contrario do dashboard) - "mais pedido" no contexto de
  // estoque e' a popularidade historica do produto, nao uma janela
  // configuravel. Item CANCELADO nao conta como "comprado".
  async obterMaisPedidos(limite: number): Promise<ProdutoMaisPedidoDto[]> {
    const agrupado = await this.prisma.pedidoItem.groupBy({
      by: ['produtoId'],
      where: { produtoId: { not: null }, situacao: { not: 'CANCELADO' } },
      _sum: { quantidadeVenda: true },
      orderBy: { _sum: { quantidadeVenda: 'desc' } },
      take: limite,
    });
    if (agrupado.length === 0) {
      return [];
    }

    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: agrupado.map((linha) => linha.produtoId as string) } },
      select: { id: true, nome: true, codigo: true },
    });
    const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

    const codigos = produtos
      .map((p) => p.codigo)
      .filter((codigo): codigo is string => codigo !== null);
    const saldos = await this.prisma.saldoEstoque.findMany({
      where: { codigoProduto: { in: codigos } },
    });
    const saldoPorCodigo = new Map(saldos.map((s) => [s.codigoProduto, s]));

    return agrupado
      .filter((linha) => produtoPorId.has(linha.produtoId as string))
      .map((linha) => {
        const produto = produtoPorId.get(linha.produtoId as string)!;
        const saldo = produto.codigo ? saldoPorCodigo.get(produto.codigo) : undefined;
        return {
          produtoId: produto.id,
          nome: produto.nome,
          codigo: produto.codigo as string,
          quantidadeTotalPedida: Number(linha._sum.quantidadeVenda ?? 0),
          quantidadeDisponivel: saldo ? saldo.quantidadeDisponivel.toString() : null,
        };
      });
  }
}
