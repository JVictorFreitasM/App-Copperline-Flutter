import { posix } from 'node:path';

// Padrao confirmado com o usuario (2026-09-23), a partir de exemplos reais
// de nome de arquivo: o nome e' a CHAVE DE ACESSO da NF-e (44 digitos,
// padrao SEFAZ: cUF+AAMM+CNPJ+modelo+serie+numero+tpEmis+cNF+cDV) seguida
// de "-nfe.pdf". A pasta e' organizada por ANO/MES/DIA da data de EMISSAO
// (nao de sincronizacao nem de autorizacao). So NF-e (decisao confirmada) -
// NFS-e usa um padrao de chave municipal diferente, nao coberto aqui.
//
// Retorna null quando falta `chave` ou `dataEmissao` - nao ha' PDF pra
// resolver nesses casos (ex: nota ainda incompleta, ou nota que so' tem
// NFS-e). Quem chama trata null como "PDF nao disponivel", nunca como
// erro de programacao.
export function resolverCaminhoPdfNotaFiscal(
  nota: { chave: string | null; dataEmissao: Date | null },
  baseDir: string,
): string | null {
  if (!nota.chave || !nota.dataEmissao) {
    return null;
  }

  const ano = String(nota.dataEmissao.getUTCFullYear());
  const mes = String(nota.dataEmissao.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(nota.dataEmissao.getUTCDate()).padStart(2, '0');

  // posix.join (nao join generico) - o backend sempre roda dentro do
  // container Linux (Dockerfile node:24-slim, ver docker-compose.yml),
  // entao o separador certo E' "/" sempre; usar o join generico misturaria
  // "\" quando os testes rodam direto no host Windows deste projeto,
  // divergindo do comportamento real em produção.
  return posix.join(baseDir, ano, mes, dia, `${nota.chave}-nfe.pdf`);
}
