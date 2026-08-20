// O campo "config" das chamadas ao WK BI (Executivo.svc) e' uma string
// pseudo-INI (`"Chave"="Valor";...`), nao JSON aninhado, mesmo estando
// dentro de um corpo JSON (ver skill wk-radar-bi-client). Centralizado aqui
// pra nao arriscar concatenacao manual divergente em cada call site.
export function buildWkBiReportConfig(params: Record<string, string>): string {
  return (
    Object.entries(params)
      .map(
        ([chave, valor]) => `"${chave}"="${escaparValorConfig(chave, valor)}"`,
      )
      .join(';') + ';'
  );
}

// A skill wk-radar-bi-client so documenta escaping pro envelope JSON externo
// (que o proprio JSON.stringify do axios ja resolve sozinho) - nao ha
// confirmacao de que o parser pseudo-INI do WK Radar respeita algum escape
// de aspas dentro do valor (ex: \"). Sem essa confirmacao, "escapar" aqui
// seria adivinhar um comportamento do servidor: se o parser do WK nao
// honrar o escape, a aspas ainda quebraria a estrutura do config mesmo
// escapada, so que com falsa sensacao de seguranca. Rejeitar (fail closed)
// e' a opcao segura - nenhum parametro legitimo hoje (Empresa, Hash,
// CodProdutos) tem motivo pra conter aspas.
function escaparValorConfig(chave: string, valor: string): string {
  if (valor.includes('"')) {
    throw new Error(
      `Parametro '${chave}' do relatorio WK BI contem aspas duplas - rejeitado (sem escaping confirmado pro formato pseudo-INI do WK Radar).`,
    );
  }
  return valor;
}
