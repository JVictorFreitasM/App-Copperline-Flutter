// Mesmo shape de backend/src/solicitacoes-desconto/configuracao-desconto.
// service.ts (ConfiguracaoDescontoDto) - duplicado aqui por não haver
// pacote compartilhado entre front e back. Tela de Configurações (Épico 4,
// OS-dashboard-configuracoes-notificacoes-auditoria.md), aba "Alçada de
// Aprovação".
export interface AlcadaAprovacaoDto {
  limitePercentual: number;
  habilitarAprovacaoPorAlcada: boolean;
  percentualAlcadaGerencial: number;
  percentualAlcadaSupervisao: number;
  atualizadoEm: string;
}

// Mesmo shape de
// backend/src/configuracoes/configuracao-orcamento.service.ts
// (ConfiguracaoOrcamentoDto) - aba "Orçamento".
export interface ConfiguracaoOrcamentoDto {
  habilitarCriacaoOrcamento: boolean;
  permitirVendedorTransformarEmPedido: boolean;
  criarPedidoSugeridoComoOrcamento: boolean;
  permitirAlteracaoVendedorOrcamentoCriado: boolean;
  atualizadoEm: string;
}

// Mesmo shape de
// backend/src/configuracoes/configuracao-rastreio.service.ts
// (ConfiguracaoRastreioDto) - aba "Rastreio".
export interface ConfiguracaoRastreioDto {
  desabilitarEdicaoHorarioTrabalhoAndroid: boolean;
  habilitarRastreamentoSabados: boolean;
  habilitarRastreamentoDomingos: boolean;
  horarioInicioRastreamento: string;
  horarioTerminoRastreamento: string;
  precisaoMinimaMetrosGps: number;
  tempoMinimoAcordarGpsMs: number;
  permitirRegistroComGpsDesabilitado: boolean;
  distanciaMaximaClienteRegistroPedidoMetros: number | null;
  distanciaMaximaClienteRegistroVisitaMetros: number;
  atualizadoEm: string;
}
