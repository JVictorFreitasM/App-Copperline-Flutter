// Mesmo shape de backend/src/sync/sync-config.service.ts (ConfiguracaoSyncDto)
// e backend/src/sync/sync-observability.service.ts (SyncLogResumoDto,
// RegistrosIncompletosDto) - duplicado aqui por não haver pacote
// compartilhado entre front e back (mesmo padrão de CurrentUser em auth.ts).

export type TipoCadenciaSync =
  | "INCREMENTAL"
  | "INCREMENTAL_NOTURNO"
  | "JANELA_FIXA_DIARIA"
  | "CONFIGURAVEL";

export interface ConfiguracaoSyncDto {
  nomeEntidade: string;
  tipoCadencia: TipoCadenciaSync;
  intervaloMinutos: number | null;
  horarioFixo: string | null;
  diasSemana: number[];
  origem: "CONFIGURADA" | "PADRAO";
  ultimaSincronizacaoEm: string | null;
}

export interface AtualizarConfiguracaoSyncInput {
  tipoCadencia: TipoCadenciaSync;
  intervaloMinutos?: number;
  horarioFixo?: string;
  diasSemana?: number[];
}

export interface SyncLogResumoDto {
  id: string;
  status: string;
  iniciadoEm: string;
  finalizadoEm: string | null;
  duracaoMs: number | null;
  registrosProcessados: number;
  registrosComErro: number;
  avisos: string[];
  erro: Record<string, string> | null;
}

export interface RegistroIncompletoDto {
  id: string;
  idExternoErp: string;
  incompletoDesde: string;
  idadeEmHoras: number;
}

export interface RegistrosIncompletosDto {
  cliente: RegistroIncompletoDto[];
  produto: RegistroIncompletoDto[];
  pedido: RegistroIncompletoDto[];
}

// Espelha ENTIDADES_SEM_CURSOR_INCREMENTAL de
// backend/src/sync/sync-config.service.ts - o backend rejeita
// tipoCadencia:'INCREMENTAL' pra essas duas (limitação do ERP, não
// configurável), mas nenhum campo de ConfiguracaoSyncDto sinaliza isso -
// duplicado aqui só pra desabilitar a opção na tela antes de tentar salvar
// (o backend continua sendo quem de fato recusa, isso aqui é só UX).
export const ENTIDADES_SEM_CURSOR_INCREMENTAL = new Set(["nota-fiscal", "saldo_estoque"]);

const ROTULOS_ENTIDADE: Record<string, string> = {
  cliente: "Clientes",
  produto: "Produtos",
  pedido: "Pedidos",
  "nota-fiscal": "Notas fiscais",
  saldo_estoque: "Saldo de estoque",
  vendedor: "Vendedores",
};

export function rotuloEntidade(nomeEntidade: string): string {
  return ROTULOS_ENTIDADE[nomeEntidade] ?? nomeEntidade;
}

const ROTULOS_TIPO_CADENCIA: Record<TipoCadenciaSync, string> = {
  INCREMENTAL: "Incremental",
  INCREMENTAL_NOTURNO: "Incremental noturno",
  JANELA_FIXA_DIARIA: "Janela fixa diária",
  CONFIGURAVEL: "Configurável (intervalo fixo)",
};

export function rotuloTipoCadencia(tipo: TipoCadenciaSync): string {
  return ROTULOS_TIPO_CADENCIA[tipo];
}

// Só SUCESSO ganha destaque (mesmo padrão de configSituacaoPedido em
// lib/pedidos.ts - "concluído com sucesso" é o único estado que foge do
// chip neutro, sem introduzir vermelho/verde pra erro/andamento - ver
// skill design-system).
const ROTULOS_STATUS_LOG: Record<string, string> = {
  SUCESSO: "Sucesso",
  ERRO: "Erro",
  EM_ANDAMENTO: "Em andamento",
};

export function configStatusSyncLog(status: string | undefined): {
  rotulo: string;
  enfase: boolean;
} {
  if (!status) {
    return { rotulo: "Nunca executado", enfase: false };
  }
  return { rotulo: ROTULOS_STATUS_LOG[status] ?? status, enfase: status === "SUCESSO" };
}

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
