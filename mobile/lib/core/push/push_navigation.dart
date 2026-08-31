import 'package:flutter/material.dart';
import '../../screens/aprovacoes_screen.dart';
import '../../screens/pedido_detalhe_screen.dart';
import '../../screens/produto_detalhe_screen.dart';
import 'push_config.dart';

/// Chave global de navegação (OS-MOBILE-16) - o toque numa notificação
/// (app em background/terminado) chega via callback do FCM, fora da
/// árvore de widgets, sem um `BuildContext` de tela disponível - mesmo
/// motivo pelo qual `MaterialApp.navigatorKey` existe.
final navigatorKey = GlobalKey<NavigatorState>();

/// Decide pra onde navegar a partir do payload `data` de uma notificação
/// (`RemoteMessage.data`, sempre `Map<String, dynamic>` com valores string
/// no FCM). O tipo do evento NÃO vem no payload (`EventoNotificacao.tipo`
/// não é incluído em `dados` no backend, ver
/// `NotificacaoDispatchService`/`registrarEventoNotificacao`) - o
/// discriminador é QUAL chave está presente, já que cada tipo grava um
/// conjunto de chaves próprio e sem sobreposição:
/// - PEDIDO_SITUACAO_ALTERADA: `{pedidoId}`
/// - PRODUTO_REABASTECIDO: `{produtoId, codigoProduto}`
/// - NOTA_FISCAL_REJEITADA: `{notaFiscalId}` - sem tela de detalhe de nota
///   fiscal no mobile ainda, cai no fallback (mostra a notificação, não
///   navega a lugar nenhum).
/// - VISITA_CANCELADA: `{visitaId, vendedorId}` - endereçada ao
///   supervisor; tela de visita ainda não existe no mobile (a revisão de
///   visitas da equipe é OS-WEB-26/web, sem equivalente mobile hoje),
///   mesmo fallback.
/// - SOLICITACAO_DESCONTO_CRIADA: `{solicitacaoId}` (sem `pedidoId`,
///   endereçada ao supervisor/gerente) - cai na tela de Aprovações.
/// - SOLICITACAO_DESCONTO_DECIDIDA: `{solicitacaoId, status, pedidoId?}`
///   (endereçada ao vendedor) - quando tem `pedidoId` (caso normal, ver
///   comentário em solicitacoes-desconto.service.ts no backend) já cai no
///   check de `pedidoId` acima, sem precisar de um caso próprio aqui.
void navegarParaNotificacao(Map<String, dynamic> dados) {
  final navigator = navigatorKey.currentState;
  if (navigator == null) {
    return;
  }

  final pedidoId = dados['pedidoId'] as String?;
  if (pedidoId != null) {
    navigator.push(MaterialPageRoute(builder: (_) => PedidoDetalheScreen(id: pedidoId)));
    return;
  }

  final produtoId = dados['produtoId'] as String?;
  if (produtoId != null) {
    navigator.push(MaterialPageRoute(builder: (_) => ProdutoDetalheScreen(id: produtoId)));
    return;
  }

  // Só entra aqui quando NÃO tem pedidoId (senão já teria retornado acima) -
  // é exatamente o caso SOLICITACAO_DESCONTO_CRIADA (supervisor).
  final solicitacaoId = dados['solicitacaoId'] as String?;
  if (solicitacaoId != null) {
    navigator.push(MaterialPageRoute(builder: (_) => const AprovacoesScreen()));
    return;
  }

  // notaFiscalId/visitaId: sem tela de destino no mobile ainda - a
  // notificação em si já foi mostrada pelo SO (background/terminado) ou
  // pelo banner de foreground (ver push_service.dart), só não há pra onde
  // navegar além disso.
}

/// Categoria (pra respeitar a preferência local, ver push_config.dart) a
/// partir do mesmo critério de "qual chave está presente".
CategoriaNotificacao? categoriaDoPayload(Map<String, dynamic> dados) {
  // pedidoId ANTES de solicitacaoId de propósito - SOLICITACAO_DESCONTO_DECIDIDA
  // (vendedor) tem os dois quando o pedido é conhecido, e deve contar como
  // "Pedidos" (é sobre o pedido dele), não uma categoria própria.
  if (dados.containsKey('pedidoId')) return CategoriaNotificacao.pedidos;
  if (dados.containsKey('produtoId')) return CategoriaNotificacao.estoque;
  if (dados.containsKey('notaFiscalId')) return CategoriaNotificacao.notasFiscais;
  if (dados.containsKey('visitaId')) return CategoriaNotificacao.visitasEquipe;
  if (dados.containsKey('solicitacaoId')) return CategoriaNotificacao.aprovacoesDesconto;
  return null;
}
