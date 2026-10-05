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
  criadoEm: string;
}

export interface ResultadoEnvioMensagemDto {
  id: string;
  totalDestinatarios: number;
  semAppVinculado: number;
}
