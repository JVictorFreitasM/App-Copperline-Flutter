import { createHash } from 'node:crypto';

// JSON canonico (chaves em ordem, sem espacos, inteiros sem ".0") - o mesmo
// algoritmo existe no app (mobile/lib/core/local_db/hash_acao.dart), pra os
// dois lados chegarem ao MESMO hash de uma acao da fila offline. Qualquer
// mudanca aqui precisa mudar la tambem (ha teste de paridade nos dois
// lados com o mesmo valor esperado).
export function jsonCanonico(valor: unknown): string {
  if (valor === null || valor === undefined) return 'null';
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'boolean') return String(valor);
  if (typeof valor === 'string') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  const objeto = valor as Record<string, unknown>;
  const chaves = Object.keys(objeto)
    .filter((chave) => objeto[chave] !== undefined)
    .sort();
  return `{${chaves.map((chave) => `${JSON.stringify(chave)}:${jsonCanonico(objeto[chave])}`).join(',')}}`;
}

export interface AcaoParaHash {
  idLocal: string;
  tipo: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface ComprovanteAcao {
  hash: string;
  bytes: number;
}

// Comprovante (ack) do que o servidor RECEBEU de uma acao: o app so' marca
// a acao como confirmada se o hash devolvido bater com o que ele enviou.
export function comprovanteDaAcao(acao: AcaoParaHash): ComprovanteAcao {
  const canonico = jsonCanonico({
    idLocal: acao.idLocal,
    tipo: acao.tipo,
    timestamp: acao.timestamp,
    payload: acao.payload,
  });
  return {
    hash: createHash('sha256').update(canonico, 'utf8').digest('hex'),
    bytes: Buffer.byteLength(canonico, 'utf8'),
  };
}
