// Regra de negocio real (OS-BACKEND-24): decisao de como converter metros
// desejados numa quantidade de venda valida, com comportamento DIFERENTE
// por tipo (arredonda/aceita fracao/exige divisao exata) - por isso vive
// isolada aqui (ver skill nestjs, "DDD so onde ha regra de negocio real"),
// sem depender de Prisma/HTTP. ProdutoCalculoService so busca os dados do
// produto e chama esta funcao.
//
// PENDENCIA (ver schema.prisma, Produto.tipoVenda): a origem/regra de
// classificacao POC/RET/KM (incluindo o corte exato entre 30-50m) ainda
// nao foi confirmada com quem define a regra de negocio - esta funcao so
// implementa o CALCULO dado um tipoVenda ja conhecido, nao decide como
// classificar o produto.

export type TipoVendaProduto = 'POC' | 'RET' | 'KM';
export type UnidadeCalculo = 'PECA' | 'METRO' | 'KM';

export class TipoVendaNaoConfiguradoError extends Error {}
export class ComprimentoNaoConfiguradoError extends Error {}
export class QuantidadeNaoFechaEmUnidadeError extends Error {}

export interface ResultadoCalculoQuantidade {
  quantidade: number;
  unidade: UnidadeCalculo;
  valorTotal: number;
}

// Tolerancia pra comparacao de ponto flutuante na divisao de KM (ex:
// 150/50 pode nao dar exatamente 3.0 em IEEE 754) - sem isso, uma divisao
// matematicamente exata poderia ser rejeitada por erro de arredondamento
// binario, nao por ser realmente fracionaria.
const EPSILON = 1e-6;

export function calcularQuantidadePedido(
  tipoVenda: TipoVendaProduto | null,
  comprimentoMetros: number | null,
  precoUnitario: number,
  metrosDesejados: number,
): ResultadoCalculoQuantidade {
  if (!tipoVenda) {
    throw new TipoVendaNaoConfiguradoError(
      'Produto sem tipoVenda configurado (POC/RET/KM) - nao e possivel calcular a quantidade do pedido',
    );
  }

  if (tipoVenda === 'RET') {
    // Retalho: aceita fracionario sem exigir comprimento cadastrado - o
    // vendedor pede exatamente os metros que precisa, cortados sob medida.
    return {
      quantidade: metrosDesejados,
      unidade: 'METRO',
      valorTotal: arredondarMoeda(metrosDesejados * precoUnitario),
    };
  }

  if (comprimentoMetros === null || comprimentoMetros <= 0) {
    throw new ComprimentoNaoConfiguradoError(
      'Produto sem comprimentoMetros cadastrado - necessario para calcular POC/KM',
    );
  }

  const divisao = metrosDesejados / comprimentoMetros;

  if (tipoVenda === 'POC') {
    // Peca: sempre arredonda pra unidade inteira mais proxima (minimo 1 -
    // nao existe pedido de "0 pecas"). "Arredonda", nao "erro" - diferente
    // de KM, ver criterio de aceite desta OS.
    const quantidade = Math.max(1, Math.round(divisao));
    const metrosEfetivos = quantidade * comprimentoMetros;
    return {
      quantidade,
      unidade: 'PECA',
      valorTotal: arredondarMoeda(metrosEfetivos * precoUnitario),
    };
  }

  // KM: exige divisao EXATA (unidade fechada) - erro claro se nao fechar,
  // nunca arredonda (criterio de aceite: "retornando erro claro se o
  // valor pedido nao fechar em unidade cheia").
  const quantidade = Math.round(divisao);
  const fechaEmUnidadeCheia =
    quantidade > 0 && Math.abs(divisao - quantidade) < EPSILON;

  if (!fechaEmUnidadeCheia) {
    throw new QuantidadeNaoFechaEmUnidadeError(
      `${metrosDesejados}m nao fecha em unidades cheias de ${comprimentoMetros}m (KM) - peca um multiplo exato de ${comprimentoMetros}m`,
    );
  }

  return {
    quantidade,
    unidade: 'KM',
    valorTotal: arredondarMoeda(metrosDesejados * precoUnitario),
  };
}

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
