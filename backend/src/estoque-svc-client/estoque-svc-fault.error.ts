// RadarWebDotNetWCFFaultFault (ver skill wk-radar-client / OS de saldo de
// estoque) - erro de NEGOCIO do servico (ex: filtro invalido), nao falha de
// rede/protocolo. Tipado a parte pra quem consome (SaldoEstoqueSyncStrategy)
// poder logar os 3 campos, mas ainda assim e' tratado como falha normal de
// fetch() pelo SyncService (marca SyncLog como ERRO, nao avanca cursor,
// nao derruba a aplicacao - mecanismo generico ja existente, nada novo).
export class EstoqueSvcFaultError extends Error {
  constructor(
    readonly funcao: string | null,
    readonly idMensagem: string | null,
    readonly mensagem: string | null,
  ) {
    super(`Estoque.svc retornou fault: ${mensagem ?? 'sem mensagem'}`);
    this.name = 'EstoqueSvcFaultError';
  }
}
