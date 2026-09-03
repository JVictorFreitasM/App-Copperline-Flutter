// Mesmo formato de fault de Estoque.svc (RadarWebDotNetWCFFaultFault, ver
// estoque-svc-fault.error.ts) - servico WCF legado do mesmo servidor
// Radar, mesma familia de erro de negocio (filtro invalido, cliente nao
// encontrado, etc).
export class FinanceiroSvcFaultError extends Error {
  constructor(
    readonly funcao: string | null,
    readonly idMensagem: string | null,
    readonly mensagem: string | null,
  ) {
    super(`Financeiro.svc retornou fault: ${mensagem ?? 'sem mensagem'}`);
    this.name = 'FinanceiroSvcFaultError';
  }
}
