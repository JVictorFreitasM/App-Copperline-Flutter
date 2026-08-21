// Interpretacao da resposta ja parseada (JSON - ver
// estoque-svc-client.service.ts) - separado do service pra ser testavel
// com objetos JS simples direto.
//
// Navegacao "por busca" (nao por caminho fixo tipo
// documento.BuscarSaldoProdutoResult.QuantidadeDisponivelProdutos...) -
// busca recursiva por qualquer objeto com os campos esperados e' mais
// resiliente a variacao de wrapper do que hardcodar um caminho, sem custo
// real (payload de ~1500 itens, arvore pequena).
export interface FaultInfo {
  funcao: string | null;
  idMensagem: string | null;
  mensagem: string | null;
}

export function encontrarFault(documento: unknown): FaultInfo | null {
  const encontrado = buscarPrimeiro(
    documento,
    (obj) => 'Mensagem' in obj && ('Funcao' in obj || 'IdMensagem' in obj),
  );
  if (!encontrado) {
    return null;
  }
  return {
    funcao: valorTextoOuNulo(encontrado['Funcao']),
    idMensagem: valorTextoOuNulo(encontrado['IdMensagem']),
    mensagem: valorTextoOuNulo(encontrado['Mensagem']),
  };
}

export function encontrarItensSaldo(documento: unknown): Record<string, unknown>[] {
  const resultado: Record<string, unknown>[] = [];
  percorrer(documento, (obj) => {
    if ('CodigoProduto' in obj && 'QuantidadeDisponivel' in obj) {
      resultado.push(obj);
    }
  });
  return resultado;
}

function buscarPrimeiro(
  no: unknown,
  predicado: (obj: Record<string, unknown>) => boolean,
): Record<string, unknown> | null {
  let encontrado: Record<string, unknown> | null = null;
  percorrer(no, (obj) => {
    if (!encontrado && predicado(obj)) {
      encontrado = obj;
    }
  });
  return encontrado;
}

function percorrer(no: unknown, visitar: (obj: Record<string, unknown>) => void): void {
  if (Array.isArray(no)) {
    for (const item of no) {
      percorrer(item, visitar);
    }
    return;
  }
  if (no !== null && typeof no === 'object') {
    const obj = no as Record<string, unknown>;
    visitar(obj);
    for (const valor of Object.values(obj)) {
      percorrer(valor, visitar);
    }
  }
}

function valorTextoOuNulo(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  return String(valor);
}
