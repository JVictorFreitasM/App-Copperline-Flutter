import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfiguracaoTabelaPrecoService } from './configuracao-tabela-preco.service';

// Pedido do usuario: "coloque o preço de venda vindo da tabela no preço
// do produto" - a tabela de preco SELECIONADA (ver
// ConfiguracaoTabelaPrecoService/TabelaPrecoSyncStrategy) passa a ser a
// fonte de verdade do preco exibido pro produto, nao mais
// Produto.precoVenda (campo cru sincronizado do cadastro do produto no
// Radar - confirmado na pratica que costuma vir zerado). Servico isolado
// (nao dentro de ProdutosService) pra ser reaproveitado por qualquer
// lugar que mostre preco de produto, sem duplicar a resolucao de qual
// codigo esta selecionado e o join por codigo.
@Injectable()
export class PrecoProdutoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuracaoTabelaPrecoService: ConfiguracaoTabelaPrecoService,
  ) {}

  // Mapa codigoProduto -> preco (string, ja formatado como Decimal.toString())
  // da tabela selecionada atual. Retorna mapa vazio (nao lanca erro)
  // quando nenhum codigo foi selecionado ainda, ou a tabela selecionada
  // ainda nao terminou de sincronizar - quem chama decide o fallback
  // (normalmente Produto.precoVenda cru).
  async obterPrecosDaTabelaPadrao(): Promise<Map<string, string>> {
    const tabela = await this.obterTabelaSelecionada();
    if (!tabela) {
      return new Map();
    }

    const itens = await this.prisma.itemTabelaPreco.findMany({
      where: { tabelaPrecoId: tabela.id },
      select: { codigoItem: true, preco: true },
    });
    return new Map(itens.map((item) => [item.codigoItem, item.preco.toString()]));
  }

  // Consulta pontual de UM produto (evita buscar a tabela inteira quando
  // só um preço é necessário, ex: detalhe de produto).
  async obterPrecoPorCodigo(codigoProduto: string): Promise<string | null> {
    const tabela = await this.obterTabelaSelecionada();
    if (!tabela) {
      return null;
    }

    const item = await this.prisma.itemTabelaPreco.findUnique({
      where: { tabelaPrecoId_codigoItem: { tabelaPrecoId: tabela.id, codigoItem: codigoProduto } },
      select: { preco: true },
    });
    return item?.preco.toString() ?? null;
  }

  // OS-novas-implementacoes.md Bloco 1 - preco por uma tabela EXPLICITA
  // (nao a selecionada globalmente) - usado pelo calculo com seletor de
  // tabela (ProdutoCalculoService.calcular). null tanto quando a tabela
  // nao existe/nao foi sincronizada ainda quanto quando o produto nao tem
  // item cadastrado NESSA tabela especifica - quem chama decide se isso
  // vira erro (nao cai silenciosamente pro preco de outra fonte, ao
  // contrario do fallback global de obterPrecoPorCodigo acima - o usuario
  // pediu explicitamente ESSA tabela).
  async obterPrecoPorCodigoDeTabela(
    codigoTabela: string,
    codigoProduto: string,
  ): Promise<string | null> {
    const tabela = await this.prisma.tabelaPreco.findUnique({
      where: { codigo: codigoTabela },
      select: { id: true },
    });
    if (!tabela) {
      return null;
    }

    const item = await this.prisma.itemTabelaPreco.findUnique({
      where: { tabelaPrecoId_codigoItem: { tabelaPrecoId: tabela.id, codigoItem: codigoProduto } },
      select: { preco: true },
    });
    return item?.preco.toString() ?? null;
  }

  // OS-novas-implementacoes.md Bloco 1 - comparativo de preco por tabela
  // (GET /produtos/:id/precos). Sem `codigosRestricao`, compara contra
  // toda tabela ATIVA; com a lista (ex: tabelas associadas a um cliente
  // especifico), restringe a elas.
  async obterPrecosPorTabela(
    codigoProduto: string,
    codigosRestricao?: string[],
  ): Promise<{ codigo: string; preco: string | null }[]> {
    const tabelas = await this.prisma.tabelaPreco.findMany({
      where: {
        ativa: true,
        ...(codigosRestricao && codigosRestricao.length > 0
          ? { codigo: { in: codigosRestricao } }
          : {}),
      },
      select: { id: true, codigo: true },
      orderBy: { codigo: 'asc' },
    });

    const itens = await this.prisma.itemTabelaPreco.findMany({
      where: {
        tabelaPrecoId: { in: tabelas.map((t) => t.id) },
        codigoItem: codigoProduto,
      },
      select: { tabelaPrecoId: true, preco: true },
    });
    const precoPorTabelaId = new Map(itens.map((item) => [item.tabelaPrecoId, item.preco.toString()]));

    return tabelas.map((tabela) => ({
      codigo: tabela.codigo,
      preco: precoPorTabelaId.get(tabela.id) ?? null,
    }));
  }

  private async obterTabelaSelecionada(): Promise<{ id: string } | null> {
    const codigoSelecionado = await this.configuracaoTabelaPrecoService.obterCodigoSelecionado();
    if (!codigoSelecionado) {
      return null;
    }
    return this.prisma.tabelaPreco.findUnique({
      where: { codigo: codigoSelecionado },
      select: { id: true },
    });
  }
}
