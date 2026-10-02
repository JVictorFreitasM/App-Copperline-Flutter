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

// Pra onde levar quem abre a notificação - o discriminador é QUAL chave
// está em `dados` (mesmo critério do app, mobile/lib/core/push/
// push_navigation.dart): `pedidoId` abre o pedido (vendedor: decisão do
// desconto; qualquer evento de pedido), `solicitacaoId` sem pedido leva o
// supervisor à tela de Aprovações. Sem chave conhecida, a notificação não
// navega (continua só informativa).
export function destinoDaNotificacao(dados: unknown): { href: string; rotulo: string } | null {
  if (typeof dados !== "object" || dados === null) {
    return null;
  }
  const { pedidoId, solicitacaoId } = dados as Record<string, unknown>;
  if (typeof pedidoId === "string" && pedidoId.length > 0) {
    return { href: `/pedidos/${encodeURIComponent(pedidoId)}`, rotulo: "Ver pedido" };
  }
  if (typeof solicitacaoId === "string" && solicitacaoId.length > 0) {
    return { href: "/aprovacoes", rotulo: "Ver aprovações" };
  }
  return null;
}
