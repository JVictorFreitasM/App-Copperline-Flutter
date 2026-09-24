// Mesmo shape de backend/src/oportunidades/domain/detectar-oportunidade.ts
// (MotivoOportunidade) e oportunidade-cliente.service.ts
// (OportunidadeClienteDto) - duplicado aqui por não haver pacote
// compartilhado entre front e back.
export type MotivoOportunidade =
  | { tipo: "SEM_PEDIDO_HA_DIAS"; dias: number }
  | { tipo: "ANIVERSARIO_RELACIONAMENTO"; anos: number }
  | {
      tipo: "RECOMPRA_PROXIMA";
      produtoId: string;
      intervaloMedioDias: number;
      diasDesdeUltimaCompra: number;
    };

export interface OportunidadeClienteDto {
  clienteId: string;
  clienteNome: string | null;
  motivo: MotivoOportunidade;
  ultimaInteracaoEm: string | null;
  // null quando a geração por IA falhou (ex: sem chave configurada) - o
  // motivo estrutural continua válido e exibido, só a frase de contexto
  // fica ausente.
  contexto: string | null;
}

// Frase curta a partir do motivo ESTRUTURAL (regra determinística, nunca
// texto da IA) - sempre disponível, mesmo quando `contexto` (LLM) é null.
export function rotuloMotivo(motivo: MotivoOportunidade): string {
  switch (motivo.tipo) {
    case "SEM_PEDIDO_HA_DIAS":
      return `Sem pedido há ${motivo.dias} dia(s)`;
    case "ANIVERSARIO_RELACIONAMENTO":
      return `Aniversário de relacionamento (${motivo.anos} ano(s))`;
    case "RECOMPRA_PROXIMA":
      return `Recompra próxima (costuma comprar a cada ${motivo.intervaloMedioDias} dia(s), última há ${motivo.diasDesdeUltimaCompra})`;
  }
}
