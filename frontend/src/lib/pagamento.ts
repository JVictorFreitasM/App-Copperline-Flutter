// Mesmo shape de backend/src/pagamento/dto/pagamento-response.dto.ts -
// duplicado aqui por não haver pacote compartilhado entre front e back
// (mesmo critério já usado em lib/pedidos.ts). Catálogos sincronizados do
// WK Radar (ver sync/strategies/forma-pagamento.sync.ts e
// condicao-pagamento.sync.ts) - só as ativas/vigentes já vêm filtradas
// pelo backend (PagamentoService).
export interface FormaPagamentoDto {
  id: string;
  codigo: string | null;
  descricao: string | null;
}

export interface ParcelaCondicaoPagamentoDto {
  percentual: number;
  prazo: number;
}

export interface CondicaoPagamentoDto {
  id: string;
  codigo: string | null;
  nome: string | null;
  aVista: boolean;
  comEntrada: boolean;
  antecipada: boolean;
  parcelas: ParcelaCondicaoPagamentoDto[];
}

// Listagem admin (GET /admin/formas-pagamento e /admin/condicoes-pagamento,
// painel de ativar/desativar) - traz TODAS (inclusive inativas no Radar),
// com os sinais de estado separados (ver
// backend/src/pagamento/dto/pagamento-response.dto.ts).
export interface AdminFormaPagamentoDto {
  id: string;
  codigo: string | null;
  descricao: string | null;
  inativaNoErp: boolean;
  desativadaManualmente: boolean;
  ativo: boolean;
}

export interface AdminCondicaoPagamentoDto {
  id: string;
  codigo: string | null;
  nome: string | null;
  validade: string | null;
  expirada: boolean;
  desativadaManualmente: boolean;
  ativo: boolean;
}
