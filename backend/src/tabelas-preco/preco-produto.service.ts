import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Pedido do usuario: "coloque o preço de venda vindo da tabela no preço
// do produto" - a tabela de preco PADRAO (TabelaPreco.padrao, ver
// TabelasPrecoService.definirPadrao) passa a ser a fonte de verdade do
// preco exibido pro produto, nao mais Produto.precoVenda (campo cru
// sincronizado do cadastro do produto no Radar). Servico isolado (nao
// dentro de ProdutosService) pra ser reaproveitado por qualquer lugar que
// mostre preco de produto (produtos, estoque "mais pedidos"), sem
// duplicar a resolucao de qual tabela é a padrão e o join por codigo.
@Injectable()
export class PrecoProdutoService {
  constructor(private readonly prisma: PrismaService) {}

  // Mapa codigoProduto -> preco (string, ja formatado como Decimal.toString())
  // da tabela padrão atual. Retorna mapa vazio (nao lanca erro) quando não
  // há tabela padrão definida ainda - quem chama decide o fallback
  // (normalmente Produto.precoVenda cru).
  async obterPrecosDaTabelaPadrao(): Promise<Map<string, string>> {
    const tabelaPadrao = await this.prisma.tabelaPreco.findFirst({
      where: { padrao: true },
      select: { id: true },
    });
    if (!tabelaPadrao) {
      return new Map();
    }

    const itens = await this.prisma.itemTabelaPreco.findMany({
      where: { tabelaPrecoId: tabelaPadrao.id },
      select: { codigoItem: true, preco: true },
    });
    return new Map(itens.map((item) => [item.codigoItem, item.preco.toString()]));
  }

  // Consulta pontual de UM produto (evita buscar a tabela inteira quando
  // só um preço é necessário, ex: detalhe de produto).
  async obterPrecoPorCodigo(codigoProduto: string): Promise<string | null> {
    const tabelaPadrao = await this.prisma.tabelaPreco.findFirst({
      where: { padrao: true },
      select: { id: true },
    });
    if (!tabelaPadrao) {
      return null;
    }

    const item = await this.prisma.itemTabelaPreco.findUnique({
      where: { tabelaPrecoId_codigoItem: { tabelaPrecoId: tabelaPadrao.id, codigoItem: codigoProduto } },
      select: { preco: true },
    });
    return item?.preco.toString() ?? null;
  }
}
