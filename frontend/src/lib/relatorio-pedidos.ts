// Mesmo shape de
// backend/src/pedidos/dto/relatorio-pedidos-response.dto.ts
// (RelatorioPedidosDto, GET /pedidos/relatorio) - duplicado aqui por não
// haver pacote compartilhado entre front e back. statusAprovacao,
// diasPendente e destaquePendenciaAntiga já vêm calculados pelo backend -
// o front só formata (mesmo critério de "sem cálculo duplicado no front"
// já usado em OS-WEB-22/23).
export type StatusAprovacaoPedido = "PENDENTE" | "APROVADO" | "REJEITADO" | "ENVIADO" | null;

export interface RelatorioPedidoItemDto {
  id: string;
  numero: string | null;
  situacao: string | null;
  statusAprovacao: StatusAprovacaoPedido;
  diasPendente: number | null;
  destaquePendenciaAntiga: boolean;
  dataHoraUltimaAlteracao: string | null;
  valorTotal: string | null;
  cliente: { id: string; razaoSocial: string | null } | null;
}

export interface RelatorioVendedorDto {
  vendedorId: string;
  vendedorNome: string | null;
  totalPedidos: number;
  pendentesAtuais: number;
  pedidos: RelatorioPedidoItemDto[];
}

export interface RelatorioPedidosDto {
  periodo: { dataInicial: string | null; dataFinal: string | null };
  vendedores: RelatorioVendedorDto[];
}

const ROTULOS_STATUS_APROVACAO: Record<string, string> = {
  PENDENTE: "Aguardando aprovação",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  ENVIADO: "Enviado",
};

export function rotuloStatusAprovacao(status: StatusAprovacaoPedido): string {
  if (!status) return "—";
  return ROTULOS_STATUS_APROVACAO[status] ?? status;
}

export const OPCOES_STATUS_APROVACAO = Object.entries(ROTULOS_STATUS_APROVACAO).map(
  ([valor, rotulo]) => ({ valor, rotulo }),
);
