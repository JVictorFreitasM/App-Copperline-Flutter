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
  // Chave de acesso SEFAZ real (44 digitos) - achado 2026-09-23, testando
  // arquivos reais de PDF: o campo top-level `chave` (WkRadarNotaFiscal.
  // chave) NAO e' isso, e' outro codigo interno do WK Radar (formato
  // "0125-000001", visto contra o ambiente real) - a skill wk-radar-client
  // so marcava aquele campo como "provavel" chave de acesso, nunca
  // confirmado. `nfe.chaveAcesso` e' o campo certo, confirmado contra
  // resposta real da API.
  chaveAcesso?: string | null;
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
  // NAO e' a chave de acesso SEFAZ (formato visto: "0125-000001") - codigo
  // interno do WK Radar, significado nao confirmado, sem uso no sistema
  // hoje. A chave de acesso real fica em nfe.chaveAcesso (ver
  // WkRadarNotaFiscalNfe acima) - NUNCA usar este campo pra idempotencia/
  // resolucao de PDF, so o de dentro de `nfe`.
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
