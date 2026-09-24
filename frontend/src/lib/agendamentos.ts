// Mesmo shape de backend/src/visitas/dto/agendamento-visita-response.dto.ts
// (AgendamentoVisitaDto/AgendamentoVisitaEquipeDto) - duplicado aqui por
// não haver pacote compartilhado entre front e back.
export interface AgendamentoVisitaDto {
  id: string;
  clienteId: string;
  vendedorId: string;
  dataHoraPrevista: string;
  criadoEm: string;
}

export interface AgendamentoVisitaEquipeDto extends AgendamentoVisitaDto {
  vendedor: { id: string; nome: string | null };
  cliente: { id: string; razaoSocial: string | null };
}
