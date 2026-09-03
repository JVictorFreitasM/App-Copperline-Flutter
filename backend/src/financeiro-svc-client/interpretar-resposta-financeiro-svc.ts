import type { PosicaoFinanceiraBruta } from './financeiro-svc-client.types';

// Reaproveita encontrarFault (busca generica por "Mensagem" + "Funcao"/
// "IdMensagem" em qualquer nivel da arvore) - mesmo formato de fault em
// todo servico WCF legado deste servidor Radar, ver
// estoque-svc-client/interpretar-resposta-estoque-svc.ts.
export { encontrarFault } from '../estoque-svc-client/interpretar-resposta-estoque-svc';

export function encontrarPosicaoFinanceira(
  documento: unknown,
): PosicaoFinanceiraBruta | null {
  return buscarPrimeiro(
    documento,
    (obj) => 'ValorLimite' in obj && 'ValorCreditoDisponivel' in obj,
  ) as PosicaoFinanceiraBruta | null;
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
