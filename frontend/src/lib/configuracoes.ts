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
  // 2026-09-24 - por padrao BLOQUEADO (mesmo comportamento de sempre, ver
  // CriarPedidoService.validarItensSemDuplicata no backend).
  permitirItensRepetidos: boolean;
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

// Mesmo shape de backend/src/llm-client/configuracao-llm.service.ts
// (ConfiguracaoLlmDto) - aba "LLM" (2026-09-24, unificada aqui - antes
// vivia sozinha em /admin/llm). apiKey nunca aparece aqui - gerenciamento
// das chaves em si e' via ChaveLlmDto abaixo.
export interface ConfiguracaoLlmDto {
  provedor: string;
  modelo: string;
  // 2026-09-25 - liga/desliga o fallback em cadeia entre chaves (switch na
  // tela). Default LIGADO - desligado, so a primeira chave ativa (menor
  // ordem) e' tentada, sem cair pra proxima se ela falhar.
  fallbackAtivo: boolean;
  atualizadoEm: string;
}

// Mesmo shape de backend/src/llm-client/chave-llm.service.ts (ChaveLlmDto) -
// multiplas chaves com fallback em cadeia (ordem crescente = prioridade,
// reordenavel por drag-and-drop na tela). chavePreview e' so os 4 ultimos
// caracteres mascarados - a chave crua nunca sai do backend.
export interface ChaveLlmDto {
  id: string;
  rotulo: string;
  chavePreview: string;
  ordem: number;
  ativa: boolean;
  atualizadoEm: string;
}

// Mesmo shape de backend/src/configuracoes/dados-empresa-pdf.service.ts
// (DadosEmpresaPdfDto) - aba "Documento do Pedido". Cabecalho fixo do PDF
// de impressao do pedido (pedido do usuario, 2026-09-28).
export interface DadosEmpresaPdfDto {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cep: string;
  telefone: string;
  atualizadoEm: string;
}

// Mesmo shape de
// backend/src/configuracoes/comunicado-pedido-pdf.service.ts
// (ComunicadoPedidoPdfDto) - "Comunicado" (2a pagina do PDF, "Premissas e
// Outras Observações" no modelo de referencia). Relacao 1:N (pedido do
// usuario): o texto atual se aplica a todo PDF gerado dali em diante.
export interface ComunicadoPedidoPdfDto {
  texto: string;
  atualizadoEm: string;
}
