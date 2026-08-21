// Mesmo shape de backend/src/notas-fiscais/dto/nota-fiscal-response.dto.ts
// (NotaFiscalDto) - duplicado aqui por não haver pacote compartilhado
// entre front e back (mesmo padrão de PedidoResumoDto em pedidos.ts).
// Nota fiscal não tem cliente próprio no schema - só alcançável via
// pedidos[].cliente (mesma ressalva já registrada no backend).
export interface ClienteResumoNotaFiscalDto {
  id: string;
  razaoSocial: string | null;
}

export interface PedidoResumoNotaFiscalDto {
  id: string;
  numero: string | null;
  cliente: ClienteResumoNotaFiscalDto | null;
}

export interface NotaFiscalDto {
  id: string;
  idExternoErp: string;
  chave: string | null;
  tipo: string | null;
  numero: number | null;
  serie: string | null;
  dataEmissao: string | null;
  statusNfe: string | null;
  nfseGerada: boolean | null;
  nfseCancelada: boolean | null;
  valorTotalNotaFiscal: string | null;
  sincronizadoEm: string;
  pedidos: PedidoResumoNotaFiscalDto[];
}

const ROTULOS_TIPO: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

export function rotuloTipoNotaFiscal(tipo: string | null): string {
  if (!tipo) {
    return "—";
  }
  return ROTULOS_TIPO[tipo] ?? tipo;
}

// Valores vêm do enum StatusNfe do backend (schema.prisma). Só dois tons
// (ver skill design-system) - AUTORIZADA é o único estado "concluído com
// sucesso" que ganha destaque; o resto (aguardando, erro, cancelada etc.)
// fica no chip neutro, mesmo padrão de configSituacaoPedido.
const ROTULOS_STATUS: Record<string, string> = {
  ERRO_VALIDACAO: "Erro de validação",
  AGUARDANDO_AUTORIZACAO: "Aguardando autorização",
  AUTORIZADA: "Autorizada",
  DENEGADA: "Denegada",
  REJEITADA: "Rejeitada",
  CANCELADA: "Cancelada",
  INUTILIZADA: "Inutilizada",
};

export function configStatusNfe(status: string | null): {
  rotulo: string;
  enfase: boolean;
} {
  if (!status) {
    return { rotulo: "—", enfase: false };
  }
  return {
    rotulo: ROTULOS_STATUS[status] ?? status,
    enfase: status === "AUTORIZADA",
  };
}

// Nome do cliente/fornecedor - derivado do primeiro pedido vinculado (nota
// fiscal não tem cliente próprio, ver comentário acima).
export function clienteDaNotaFiscal(nota: NotaFiscalDto): string {
  return nota.pedidos.find((pedido) => pedido.cliente?.razaoSocial)?.cliente
    ?.razaoSocial ?? "—";
}
