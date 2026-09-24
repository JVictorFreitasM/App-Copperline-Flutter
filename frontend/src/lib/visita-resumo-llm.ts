// Mesmo shape de backend/src/clientes/visita-resumo-llm.service.ts
// (VisitaResumoLlmDto, GET /clientes/:id/resumo-visitas) - duplicado aqui
// por não haver pacote compartilhado entre front e back.
export interface VisitaResumoLlmDto {
  clienteId: string;
  geradoEm: string;
  resumo: string;
  pontosDeAtencao: string[];
  dadosInsuficientes: boolean;
  quantidadeNotasConsideradas: number;
  fonteCache: boolean;
}
