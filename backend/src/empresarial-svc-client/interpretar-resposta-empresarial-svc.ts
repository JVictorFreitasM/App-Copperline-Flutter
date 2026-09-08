import type { TabelaPrecoBruta } from './empresarial-svc-client.types';

// Reaproveita encontrarFault (busca generica por "Mensagem" + "Funcao"/
// "IdMensagem" em qualquer nivel da arvore) - mesmo formato de fault em
// todo servico WCF legado deste servidor Radar, ver
// estoque-svc-client/interpretar-resposta-estoque-svc.ts.
export { encontrarFault } from '../estoque-svc-client/interpretar-resposta-estoque-svc';

// Navegacao "por busca" (nao por caminho fixo tipo
// documento.BuscarTabelasPrecoResult) - mesmo raciocinio ja documentado em
// interpretar-resposta-estoque-svc.ts: resiliente a variacao de wrapper,
// sem custo real (payload de dezenas de tabelas, arvore pequena por
// chamada individual mesmo que o full refresh seja grande no total).
export function encontrarTabelasPreco(documento: unknown): TabelaPrecoBruta[] {
  const resultado: TabelaPrecoBruta[] = [];
  percorrer(documento, (obj) => {
    if ('Codigo' in obj && 'ItensTabelaPreco' in obj) {
      resultado.push(obj as unknown as TabelaPrecoBruta);
    }
  });
  return resultado;
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
