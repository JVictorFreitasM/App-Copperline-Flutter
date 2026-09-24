// Mesmo shape de backend/src/coberturas/cobertura-temporaria.service.ts /
// cobertura-resumo.service.ts - duplicado aqui por não haver pacote
// compartilhado entre front e back.
export interface CoberturaTemporariaDto {
  id: string;
  vendedorOriginalId: string;
  vendedorOriginalNome: string | null;
  vendedorSubstitutoId: string;
  vendedorSubstitutoNome: string | null;
  dataInicio: string;
  dataFim: string;
  // dataInicio <= agora <= dataFim - sem estado nenhum pra "encerrar", so'
  // a passagem de dataFim (ver comentario no service).
  ativa: boolean;
}

export interface CriarCoberturaInput {
  vendedorOriginalId: string;
  vendedorSubstitutoId: string;
  dataInicio: string;
  dataFim: string;
}

export interface ClienteResumoHandoffDto {
  clienteId: string;
  clienteNome: string | null;
  // null quando a geração por IA falhou (ex: sem chave configurada).
  resumo: string | null;
}

export interface CoberturaResumoDto {
  coberturaId: string;
  clientes: ClienteResumoHandoffDto[];
}
