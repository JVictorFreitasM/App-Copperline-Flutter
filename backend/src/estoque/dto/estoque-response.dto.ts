// Campos do relatorio WK BI vem com nomes crus (ponto/espaco, ex: "Cod.",
// "Qtde Estoque") - traduzidos aqui pra um contrato estavel da nossa API,
// nunca repassados como vieram do relatorio (ver skill wk-radar-bi-client,
// secao "Formato da resposta").
// Um item por LOCAL DE ESTOCAGEM (o relatorio e' "por Local de Estocagem" -
// confirmado contra o WK BI real: um mesmo produto pode ter varias linhas,
// uma por local, e o saldo total e' a soma delas, nao um valor unico).
export interface EstoqueItemDto {
  localCodigo: string | null;
  localNome: string | null;
  lote: string | null;
  fabricadoEm: string | null;
  quantidade: string;
}

export interface EstoqueConsultaDto {
  produtoId: string;
  codigo: string;
  itens: EstoqueItemDto[];
}

export function paraEstoqueItemDto(
  linha: Record<string, unknown>,
): EstoqueItemDto {
  return {
    localCodigo: valorOuNulo(linha['Código Local']),
    localNome: valorOuNulo(linha['Nome do Local']),
    lote: valorOuNulo(linha['Lote']),
    fabricadoEm: valorOuNulo(linha['Fabricado Em']),
    quantidade: valorOuNulo(linha['Qtde Estoque']) ?? '0',
  };
}

// Campos do relatorio WK BI vem como string ou number (nunca objeto) - ver
// skill wk-radar-bi-client, secao "Formato da resposta". Restringido aqui
// em vez de aceitar `unknown` pra nao mascarar um formato inesperado atras
// de um String(valor) generico.
function valorOuNulo(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  if (typeof valor === 'string' || typeof valor === 'number') {
    return String(valor);
  }
  throw new Error(
    `Campo do relatorio WK BI com tipo inesperado: ${typeof valor}`,
  );
}
