// Fila propria do envio de cliente novo ao WK Radar - nomes explicitos, ver
// CLAUDE.md. Registrada em ClientesModule.
export const CLIENTE_ENVIO_ERP_QUEUE = 'cliente-envio-erp';
export const CLIENTE_ENVIO_ERP_JOB_NAME = 'cliente.enviar-erp';

// Quantas vezes o job tenta (rede/5xx/429) antes de marcar o cliente como ERRO.
export const CLIENTE_ENVIO_ERP_TENTATIVAS = 5;
export const CLIENTE_ENVIO_ERP_BACKOFF_MS = 30_000;

export function jobIdEnvioErp(clienteId: string): string {
  // jobId fixo por cliente: o scheduler pode re-enfileirar sem criar job
  // duplicado enquanto o anterior ainda existe na fila.
  return `cliente-${clienteId}`;
}
