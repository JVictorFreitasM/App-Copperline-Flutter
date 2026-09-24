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

// GET /agendamentos-visita/equipe (painel do supervisor/admin) - inclui
// vendedor/cliente resolvidos (join), mesmo criterio de VisitaEquipeDto em
// visita-response.dto.ts (evita o front precisar de mais chamadas so pra
// mostrar quem agendou o que pra quem).
export interface AgendamentoVisitaEquipeDto extends AgendamentoVisitaDto {
  vendedor: { id: string; nome: string | null };
  cliente: { id: string; razaoSocial: string | null };
}

export function paraAgendamentoVisitaEquipeDto(
  agendamento: AgendamentoVisita & {
    vendedor: { id: string; nome: string | null };
    cliente: { id: string; razaoSocial: string | null };
  },
): AgendamentoVisitaEquipeDto {
  return {
    ...paraAgendamentoVisitaDto(agendamento),
    vendedor: agendamento.vendedor,
    cliente: agendamento.cliente,
  };
}
