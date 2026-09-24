import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WkBiClientService } from '../wk-bi-client/wk-bi-client.service';
import { buildSaldoEstoqueLotesConfig } from '../wk-bi-client/build-saldo-estoque-lotes-config';
import { mapearLotesWkBi, somarQuantidadeFisicaTotal } from './mapear-lotes-wk-bi';
import type { EstoqueConsultaDto } from './dto/estoque-response.dto';
import type { ProdutoMaisPedidoDto } from './dto/estoque-mais-pedidos.dto';

// Combina duas fontes DIFERENTES de estoque, que nao devem ser confundidas
// (ver skill wk-radar-bi-client, achados de teste real): saldo LIQUIDO de
// pedido comprometido, ja sincronizado na tabela local SaldoEstoque
// (Estoque.svc, ver SaldoEstoqueSyncStrategy); e lotes/local de estocagem,
// consultados em TEMPO REAL a cada requisicao (Executivo.svc, Padrao 1 da
// skill - sem sync ainda, ver OS-pendentes-claude-code.md). Sem entidade
// de dominio (ver skill nest-endpoint, criterio de DDD) - so combina dado
// de duas fontes externas, nenhuma regra de negocio nossa aqui.
@Injectable()
export class EstoqueService {
  private readonly wkBiEmpresa: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wkBiClientService: WkBiClientService,
    private readonly configService: ConfigService,
  ) {
    this.wkBiEmpresa = this.configService.getOrThrow<string>('WK_BI_EMPRESA');
  }

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
      // ainda sem codigo real - nenhuma das duas fontes de estoque
      // identifica produto por outra coisa alem do CodigoProduto.
      throw new NotFoundException(
        `Produto '${identificador}' ainda não possui código sincronizado`,
      );
    }

    const [saldo, itens] = await Promise.all([
      this.prisma.saldoEstoque.findUnique({
        where: { codigoProduto: produto.codigo },
      }),
      this.buscarLotes(produto.codigo),
    ]);

    return {
      produtoId: produto.id,
      codigo: produto.codigo,
      itens,
      quantidadeFisicaTotal: somarQuantidadeFisicaTotal(itens),
      // Produto existe mas nunca teve saldo sincronizado (fora do filtro
      // Estoque Proprio, ou a sincronizacao ainda nao rodou pra ele) -
      // null, nao erro (mesmo contrato ja usado antes desta mudanca).
      quantidadeDisponivel: saldo ? saldo.quantidadeDisponivel.toString() : null,
      atualizadoEm: saldo ? saldo.atualizadoEm.toISOString() : null,
    };
  }

  // CodProdutos so aceita UM codigo valido por chamada (lista ou codigo
  // invalido nao filtram nada, devolvem o catalogo inteiro - ver skill
  // wk-radar-bi-client) - codigo aqui SEMPRE vem de Produto.codigo, ja
  // validado contra o cadastro pela query acima, nunca do que o usuario
  // digitou direto.
  private async buscarLotes(codigoProduto: string) {
    const config = buildSaldoEstoqueLotesConfig({
      empresa: this.wkBiEmpresa,
      codigoProduto,
    });
    const linhas = await this.wkBiClientService.buscarRelatorioExportacaoAutomatica(config);
    return mapearLotesWkBi(linhas);
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
