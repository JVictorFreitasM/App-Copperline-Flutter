// Subconjunto do ReadNotaFiscalDto (Radar.API, GET /comercial/v1/nota-fiscal)
// que o sistema efetivamente usa - schema completo confirmado contra o
// swagger.json do ambiente de testes (ver skill wk-radar-client). Blocos
// fiscais extensos por item e itens[] ficam fora (OS 09, "Fora de escopo").
export type TipoNotaFiscalWkRadar = 'Entrada' | 'Saida';

export type StatusNfeWkRadar =
  | 'ErroValidacao'
  | 'AguardandoAutorizacao'
  | 'Autorizada'
  | 'Denegada'
  | 'Rejeitada'
  | 'Cancelada'
  | 'Inutilizada';

export interface WkRadarNotaFiscalPedido {
  id?: string | null;
}

export interface WkRadarNotaFiscalNfe {
  status?: StatusNfeWkRadar | null;
}

export interface WkRadarNotaFiscalNfse {
  nfseGerada?: boolean;
  nfseCancelada?: boolean;
}

export interface WkRadarNotaFiscalTotal {
  valorTotalNotaFiscal?: number | null;
}

export interface WkRadarNotaFiscal {
  id: string;
  codigoIntegrador?: string | null;
  chave?: string | null;
  tipo?: TipoNotaFiscalWkRadar | null;
  numero?: number | null;
  serie?: string | null;
  dataEmissao?: string | null;
  pedidos?: WkRadarNotaFiscalPedido[] | null;
  nfe?: WkRadarNotaFiscalNfe | null;
  nfse?: WkRadarNotaFiscalNfse | null;
  total?: WkRadarNotaFiscalTotal | null;
}

export interface NotaFiscalMapeado {
  idExternoErp: string;
  codigoIntegrador: string | null;
  chave: string | null;
  tipo: string | null;
  numero: number | null;
  serie: string | null;
  dataEmissao: Date | null;
  statusNfe: string | null;
  nfseGerada: boolean | null;
  nfseCancelada: boolean | null;
  valorTotalNotaFiscal: number | null;
  pedidosExternoIds: string[];
}
