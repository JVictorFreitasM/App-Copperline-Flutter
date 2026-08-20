// Ver skill wk-radar-bi-client: resposta de BuscarRelatorioExportacaoAutomatica
// e' um array de linhas (sucesso) ou um objeto com error.message (sem dados
// ou erro de fato - so o texto da mensagem distingue os dois casos).
export type WkBiRelatorioResponse =
  Record<string, unknown>[] | { error?: { message?: string } };
