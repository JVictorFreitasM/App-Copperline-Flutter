import type { PapelVendedor } from "./vendedores";

export type StatusSolicitacaoDesconto = "PENDENTE" | "APROVADO" | "REJEITADO";

// Mesmo shape de
// backend/src/solicitacoes-desconto/solicitacoes-desconto.service.ts
// (SolicitacaoDescontoResumoDto, GET /solicitacoes-desconto) - duplicado
// aqui por não haver pacote compartilhado entre front e back. `pedido` e
// `vendedorSolicitante` já vêm resolvidos pelo backend (join por
// pedidoId/vendedorSolicitanteId) pra tela não precisar de mais chamadas
// só pra mostrar contexto legível.
export interface SolicitacaoDescontoResumoDto {
  id: string;
  pedidoId: string | null;
  percentualSolicitado: number;
  vendedorSolicitanteId: string;
  papelExigido: PapelVendedor;
  aprovadorEsperadoId: string | null;
  status: StatusSolicitacaoDesconto;
  aprovadorId: string | null;
  decididoEm: string | null;
  criadoEm: string;
  vendedorSolicitante: { id: string; nome: string | null };
  pedido: {
    id: string;
    valorTotal: string | null;
    cliente: { id: string; razaoSocial: string | null } | null;
  } | null;
}
