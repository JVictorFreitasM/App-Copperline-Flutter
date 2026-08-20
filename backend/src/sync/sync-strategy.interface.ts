export interface SyncWindow {
  desde: Date;
  ate: Date;
}

export interface SyncFetchResultado<TBruto> {
  registros: TBruto[];
  // Avisos nao-fatais levantados durante a busca (ex: suspeita de
  // truncamento silencioso numa sub-janela - ver skill wk-radar-client,
  // secao "Paginacao"). Persistidos em sync_logs.avisos pelo SyncService.
  avisos: string[];
}

// Cadencia de agendamento que a strategy espera do SyncScheduler:
// - INCREMENTAL (padrao se omitido): roda a cada 30 min, cobrindo
//   [ultimaSincronizacao, agora] - baixo volume de mudanca (cliente).
// - INCREMENTAL_NOTURNO: mesmo mecanismo de cursor do INCREMENTAL (so
//   registros alterados desde a ultima sincronizacao), mas roda uma vez por
//   noite (00:00) em vez de a cada 30 min - usado por entidades com volume
//   de itens grande o bastante pra, rodando a cada 30 min durante o
//   expediente, disputar o limite de requisicoes do WK Radar com outros
//   sistemas que usam a mesma API (produto/pedido - confirmado na pratica:
//   sincronizacao incremental de 30 em 30 min gerando 429 sustentado contra
//   o ambiente real). Rodar de madrugada, uma vez, com janela incremental
//   pequena (so o que mudou desde ontem) resolve isso sem precisar de um
//   throttle mais agressivo.
// - JANELA_FIXA_DIARIA: roda uma vez por dia (madrugada), reprocessando uma
//   janela retroativa fixa a cada execucao, ignorando o cursor incremental
//   - usado por recursos sem filtro de "alterado desde" (ver
//   NotaFiscalSyncStrategy, OS 09, pra motivacao completa).
export type SyncScheduling =
  'INCREMENTAL' | 'INCREMENTAL_NOTURNO' | 'JANELA_FIXA_DIARIA';

// Contrato que toda strategy de sincronizacao implementa (ver skill nestjs,
// secao "Arquitetura de Sincronizacao com ERP"). Adicionar uma nova entidade
// sincronizada = adicionar um novo arquivo de strategy implementando isto -
// scheduler/processor/service nunca mudam (o scheduler so ramifica pelo
// campo `agendamento`, generico, nao pelo nome da entidade).
export interface SyncStrategy<TBruto = unknown, TMapeado = unknown> {
  readonly nomeEntidade: string;
  readonly agendamento?: SyncScheduling;

  // Busca no ERP os registros alterados dentro da janela. O WK Radar nao
  // pagina nativamente (ver skill wk-radar-client) - cada strategy e
  // responsavel por fatiar a janela internamente (ver
  // paginacao-por-janela.ts) e retornar o resultado ja agregado.
  fetch(janela: SyncWindow): Promise<SyncFetchResultado<TBruto>>;

  // Traduz um registro bruto do ERP pro formato de upsert no Postgres. Nao
  // acessa banco nem HTTP - funcao pura, testavel isoladamente.
  map(bruto: TBruto): TMapeado;

  // Grava um registro ja mapeado (upsert por id_externo_erp). Chamado uma
  // vez por registro pelo SyncService, pra isolar falha de um registro sem
  // abortar o restante do lote.
  upsert(mapeado: TMapeado): Promise<void>;
}
