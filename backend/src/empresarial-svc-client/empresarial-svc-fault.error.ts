// RadarWebDotNetWCFFaultFault (mesmo formato de fault de todo servico WCF
// legado deste servidor Radar - ver estoque-svc-fault.error.ts) - erro de
// NEGOCIO do servico, nao falha de rede/protocolo.
export class EmpresarialSvcFaultError extends Error {
  constructor(
    readonly funcao: string | null,
    readonly idMensagem: string | null,
    readonly mensagem: string | null,
  ) {
    super(`Empresarial.svc retornou fault: ${mensagem ?? 'sem mensagem'}`);
    this.name = 'EmpresarialSvcFaultError';
  }
}
