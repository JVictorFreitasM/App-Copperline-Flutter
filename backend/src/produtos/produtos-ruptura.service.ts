import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Janela de historico usada pra calcular velocidade de consumo - nao e' o
// mesmo numero que `dias` (o alvo de previsao, vindo da query). 30 dias e'
// uma amostra razoavel pra suavizar picos pontuais sem ficar cega a
// mudanca recente de ritmo.
const DIAS_JANELA_CONSUMO = 30;

export interface ProdutoRupturaPrevistaDto {
  produtoId: string;
  nome: string | null;
  codigo: string;
  quantidadeDisponivel: string;
  consumoDiarioMedio: string;
  diasAteRuptura: number;
}

// Abordagem NAO-LLM (OS-BACKEND-20, item explicito do escopo: "mais
// confiavel que pedir 'previsao' a um LLM sem contexto numerico robusto") -
// regra estatistica simples e deterministica, testavel sem chamada
// externa (criterio de aceite). Sem regra de negocio alem da formula em
// si, sem entidade de dominio (ver skill nest-endpoint, criterio de DDD).
@Injectable()
export class ProdutosRupturaService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular(diasAlvo: number): Promise<ProdutoRupturaPrevistaDto[]> {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_JANELA_CONSUMO);

    const consumoPorProduto = await this.prisma.pedidoItem.groupBy({
      by: ['produtoId'],
      where: {
        produtoId: { not: null },
        situacao: { not: 'CANCELADO' },
        pedido: { dataHoraUltimaAlteracao: { gte: desde } },
      },
      orderBy: { produtoId: 'asc' },
      _sum: { quantidadeVenda: true },
    });
    if (consumoPorProduto.length === 0) {
      return [];
    }

    const produtoIds = consumoPorProduto.map((linha) => linha.produtoId as string);
    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: produtoIds }, codigo: { not: null } },
      select: { id: true, nome: true, codigo: true },
    });
    if (produtos.length === 0) {
      return [];
    }

    // SaldoEstoque nao tem FK pra Produto (casado por `codigo`, mesmo
    // padrao ja usado em dashboard.service.ts/obterEstoqueCritico).
    const saldos = await this.prisma.saldoEstoque.findMany({
      where: { codigoProduto: { in: produtos.map((p) => p.codigo as string) } },
    });
    const saldoPorCodigo = new Map(saldos.map((s) => [s.codigoProduto, s]));
    const consumoPorId = new Map(
      consumoPorProduto.map((linha) => [
        linha.produtoId as string,
        Number(linha._sum.quantidadeVenda ?? 0),
      ]),
    );

    const resultado: ProdutoRupturaPrevistaDto[] = [];
    for (const produto of produtos) {
      const saldo = saldoPorCodigo.get(produto.codigo as string);
      if (!saldo) {
        continue;
      }

      const consumoTotal = consumoPorId.get(produto.id) ?? 0;
      const consumoDiario = consumoTotal / DIAS_JANELA_CONSUMO;
      if (consumoDiario <= 0) {
        // Sem consumo recente nao e' "vai zerar" - e' indeterminado, nao
        // entra na lista (ver criterio de aceite: nao inventar previsao
        // sem base numerica).
        continue;
      }

      const quantidadeDisponivel = saldo.quantidadeDisponivel.toNumber();
      const diasAteRuptura = quantidadeDisponivel / consumoDiario;
      if (diasAteRuptura <= diasAlvo) {
        resultado.push({
          produtoId: produto.id,
          nome: produto.nome,
          codigo: produto.codigo as string,
          quantidadeDisponivel: saldo.quantidadeDisponivel.toString(),
          consumoDiarioMedio: consumoDiario.toFixed(3),
          diasAteRuptura: Math.round(diasAteRuptura * 10) / 10,
        });
      }
    }

    return resultado.sort((a, b) => a.diasAteRuptura - b.diasAteRuptura);
  }
}
