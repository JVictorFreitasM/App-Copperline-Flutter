// Mesmo shape de backend/src/notificacoes/{mensagens-notificacao,grupos-mensagem}.service.ts
// - duplicado aqui por não haver pacote compartilhado entre front e back.
export type DestinoMensagem = "TODOS" | "VENDEDOR" | "GRUPO";

export interface DestinatarioMensagemDto {
  id: string;
  nome: string;
  papel: "VENDEDOR" | "SUPERVISOR" | "GERENTE";
  comApp: boolean;
}

export interface GrupoMensagemDto {
  id: string;
  nome: string;
  vendedorIds: string[];
}

export interface MensagemEnviadaDto {
  id: string;
  assunto: string;
  corpo: string;
  destino: DestinoMensagem;
  destinoRotulo: string;
  totalDestinatarios: number;
  autorNome: string;
  periodica: boolean;
  criadoEm: string;
}

export interface ResultadoEnvioMensagemDto {
  id: string;
  totalDestinatarios: number;
  semAppVinculado: number;
}

export type FrequenciaMensagem = "DIARIA" | "DIAS_UTEIS" | "SEMANAL" | "MENSAL";

export interface MensagemPeriodicaDto {
  id: string;
  assunto: string;
  corpo: string;
  destino: DestinoMensagem;
  destinoRotulo: string;
  vendedorId: string | null;
  grupoId: string | null;
  frequencia: FrequenciaMensagem;
  horario: string;
  diaSemana: number | null;
  diaMes: number | null;
  ativa: boolean;
  proximoEnvioEm: string;
  ultimoEnvioEm: string | null;
  ultimoErro: string | null;
}

export const DIAS_DA_SEMANA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

// Texto da recorrência pra lista ("Dias úteis às 08:00", "Toda segunda às
// 08:00", "Todo dia 5 às 08:00"). O horário é sempre o de Brasília.
export function descreverRecorrencia(
  periodica: Pick<MensagemPeriodicaDto, "frequencia" | "horario" | "diaSemana" | "diaMes">,
): string {
  switch (periodica.frequencia) {
    case "DIARIA":
      return `Todos os dias às ${periodica.horario}`;
    case "DIAS_UTEIS":
      return `Dias úteis às ${periodica.horario}`;
    case "SEMANAL": {
      const dia = DIAS_DA_SEMANA[periodica.diaSemana ?? 0];
      const artigo = periodica.diaSemana === 0 || periodica.diaSemana === 6 ? "Todo" : "Toda";
      return `${artigo} ${dia} às ${periodica.horario}`;
    }
    case "MENSAL":
      return `Todo dia ${periodica.diaMes} às ${periodica.horario}`;
  }
}
