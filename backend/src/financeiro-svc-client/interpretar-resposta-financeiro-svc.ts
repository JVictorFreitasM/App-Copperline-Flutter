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

// BuscarTokenBoletoResult (ArrayOfstring no WSDL) - um token por titulo que
// bateu com o filtro (normalmente 1, o NumeroDocumento ja restringe).
// Formato JSON exato do wrapper (array puro ou algo tipo {string: [...]},
// convencao XML de ArrayOfX) nao confirmado empiricamente ainda - por isso
// desce mais um nivel se o valor achado nao for array diretamente, em vez
// de assumir um shape so.
export function encontrarTokensBoleto(documento: unknown): string[] {
  const valor = buscarValorPorChave(documento, 'BuscarTokenBoletoResult');
  if (Array.isArray(valor)) {
    return valor.filter((item): item is string => typeof item === 'string');
  }
  if (valor !== null && typeof valor === 'object') {
    for (const interno of Object.values(valor as Record<string, unknown>)) {
      if (Array.isArray(interno)) {
        return interno.filter((item): item is string => typeof item === 'string');
      }
    }
  }
  return [];
}

// DownloadBoletoResult (StreamBody/base64Binary no WSDL) - o PDF em si,
// codificado como string base64 no JSON.
export function encontrarBoletoBase64(documento: unknown): string | null {
  const valor = buscarValorPorChave(documento, 'DownloadBoletoResult');
  return typeof valor === 'string' ? valor : null;
}

function buscarValorPorChave(no: unknown, chave: string): unknown {
  if (Array.isArray(no)) {
    for (const item of no) {
      const encontrado = buscarValorPorChave(item, chave);
      if (encontrado !== undefined) {
        return encontrado;
      }
    }
    return undefined;
  }
  if (no !== null && typeof no === 'object') {
    const obj = no as Record<string, unknown>;
    if (chave in obj) {
      return obj[chave];
    }
    for (const valor of Object.values(obj)) {
      const encontrado = buscarValorPorChave(valor, chave);
      if (encontrado !== undefined) {
        return encontrado;
      }
    }
  }
  return undefined;
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
