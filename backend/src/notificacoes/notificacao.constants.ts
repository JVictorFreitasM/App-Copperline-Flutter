export const NOTIFICACAO_QUEUE = 'notificacao';
export const NOTIFICACAO_JOB_NAME = 'notificacao.processar-pendentes';

// Fila propria (nao NOTIFICACAO_QUEUE) - pedido do usuario, 2026-09-29.
// Registrada em PedidosModule (nao NotificacoesModule) de proposito:
// RelatorioDiarioNotificacaoService depende de RelatorioPedidosService
// (mesmo modulo, sem import cruzado) - importar PedidosModule dentro de
// NotificacoesModule criaria ciclo (PedidosModule ja importa ProdutosModule,
// que importa NotificacoesModule). So cria o EventoNotificacao aqui; quem
// efetivamente ENVIA o push continua sendo NotificacaoDispatchService (fila
// separada, ja existente), que so precisa dos dois casos novos em
// resolverUsuariosAlvo/resolverTokensAlvo pra saber pra quem mandar.
export const RELATORIO_DIARIO_QUEUE = 'relatorio-diario-notificacao';
export const RELATORIO_DIARIO_JOB_NAME = 'relatorio-diario.gerar';
