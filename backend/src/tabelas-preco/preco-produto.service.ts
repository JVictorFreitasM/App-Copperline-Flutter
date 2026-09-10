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
