// Regra de negocio real (OS-BACKEND-24, revisada em
// OS-novas-implementacoes.md Bloco 4): decisao de como converter metros
// desejados numa quantidade de venda valida. A fonte da regra e o
// `tamanhoPadrao` do TipoAcondicionamento associado ao produto (decisao
// confirmada com o usuario) - substitui o antigo `Produto.tipoVenda`
// (POC/RET/KM), que dependia de uma classificacao vinda do Radar que
// nunca foi resolvida (ver PENDENCIA historica em schema.prisma) e ficava
// sempre null na pratica.
//
// tamanhoPadrao null (produto sem tipo associado, ou tipo cadastrado como
// retalho) = corte fracionario livre. tamanhoPadrao preenchido = tamanho
// fixo, pedido tem que ser multiplo exato desse valor - "multiplo" (ex:
// rolo de 100m) e "unidade" (peca fechada, tamanhoPadrao=1) sao o mesmo
// calculo, sem distincao de modo (decisao confirmada).
//
// Vive isolada aqui (ver skill nestjs, "DDD so onde ha regra de negocio
// real"), sem depender de Prisma/HTTP. ProdutoCalculoService so busca os
// dados do produto/tipo e chama esta funcao.

export type UnidadeCalculo = 'PECA' | 'METRO';

export class QuantidadeNaoFechaEmUnidadeError extends Error {}

export interface ResultadoCalculoQuantidade {
  quantidade: number;
  unidade: UnidadeCalculo;
  valorTotal: number;
}

// Tolerancia pra comparacao de ponto flutuante na divisao (ex: 150/50 pode
// nao dar exatamente 3.0 em IEEE 754) - sem isso, uma divisao
// matematicamente exata poderia ser rejeitada por erro de arredondamento
// binario, nao por ser realmente fracionaria.
const EPSILON = 1e-6;

export function calcularQuantidadePedido(
  tamanhoPadrao: number | null,
  precoUnitario: number,
  metrosDesejados: number,
): ResultadoCalculoQuantidade {
  if (tamanhoPadrao === null) {
    // Retalho: aceita fracionario - o vendedor pede exatamente os metros
    // que precisa, cortados sob medida.
    return {
      quantidade: metrosDesejados,
      unidade: 'METRO',
      valorTotal: arredondarMoeda(metrosDesejados * precoUnitario),
    };
  }

  const divisao = metrosDesejados / tamanhoPadrao;
  const quantidade = Math.round(divisao);
  const fechaEmUnidadeCheia = quantidade > 0 && Math.abs(divisao - quantidade) < EPSILON;

  if (!fechaEmUnidadeCheia) {
    const multiploMaisProximo = Math.max(1, Math.round(divisao)) * tamanhoPadrao;
    throw new QuantidadeNaoFechaEmUnidadeError(
      `${metrosDesejados}m nao fecha em unidades cheias de ${tamanhoPadrao}m - ` +
        `peca um multiplo exato de ${tamanhoPadrao}m (ex: ${multiploMaisProximo}m)`,
    );
  }

  return {
    quantidade,
    unidade: 'PECA',
    valorTotal: arredondarMoeda(metrosDesejados * precoUnitario),
  };
}

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
