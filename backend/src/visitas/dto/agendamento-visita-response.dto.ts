import type { AgendamentoVisita } from '../../../generated/prisma/client';

export interface AgendamentoVisitaDto {
  id: string;
  clienteId: string;
  vendedorId: string;
  dataHoraPrevista: string;
  criadoEm: string;
}

export function paraAgendamentoVisitaDto(
  agendamento: AgendamentoVisita,
): AgendamentoVisitaDto {
  return {
    id: agendamento.id,
    clienteId: agendamento.clienteId,
    vendedorId: agendamento.vendedorId,
    dataHoraPrevista: agendamento.dataHoraPrevista.toISOString(),
    criadoEm: agendamento.criadoEm.toISOString(),
  };
}
