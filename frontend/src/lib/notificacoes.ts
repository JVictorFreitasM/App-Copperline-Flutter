// Mesmo shape de backend/src/notificacoes/notificacao-usuario.service.ts
// (NotificacaoDto) - duplicado aqui por não haver pacote compartilhado
// entre front e back.
export interface NotificacaoDto {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  dados: unknown;
  referenciaId: string;
  lida: boolean;
  lidaEm: string | null;
  criadoEm: string;
}
