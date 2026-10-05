/// Mesmo shape de `backend/src/notificacoes/notificacao-usuario.service.ts`
/// (NotificacaoDto, GET /notificacoes) - duplicado aqui por não haver
/// pacote compartilhado entre mobile e back (mesmo padrão do web,
/// `frontend/src/app/notificacoes/`). Inbox pessoal (nunca de equipe) -
/// diferente de `notificacoes_config_screen.dart`, que só configura quais
/// PUSH o dispositivo recebe em primeiro plano, sem nenhum histórico.
class Notificacao {
  const Notificacao({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.corpo,
    required this.lida,
    required this.criadoEm,
    this.dados = const {},
  });

  factory Notificacao.fromJson(Map<String, dynamic> json) {
    return Notificacao(
      id: json['id'] as String,
      tipo: json['tipo'] as String,
      titulo: json['titulo'] as String,
      corpo: json['corpo'] as String,
      lida: json['lida'] as bool,
      criadoEm: json['criadoEm'] as String,
      dados: (json['dados'] as Map?)?.cast<String, dynamic>() ?? const {},
    );
  }

  final String id;
  final String tipo;
  final String titulo;
  final String corpo;
  final bool lida;
  final String criadoEm;

  /// Payload do evento (`pedidoId`, `solicitacaoId`...) - é o que decide
  /// pra onde o toque na notificação leva (ver `navegarParaNotificacao`).
  final Map<String, dynamic> dados;

  Notificacao comoLida() => Notificacao(
    id: id,
    tipo: tipo,
    titulo: titulo,
    corpo: corpo,
    lida: true,
    criadoEm: criadoEm,
    dados: dados,
  );
}

/// Quem enviou e pra quem foi uma mensagem manual do admin, do ponto de
/// vista de quem recebeu (`destinoRotulo`: "Todos os vendedores", "Somente
/// você" ou "Grupo: X" - nunca a lista dos outros destinatários).
class MensagemInfo {
  const MensagemInfo({
    required this.autorNome,
    required this.destinoRotulo,
    required this.periodica,
  });

  factory MensagemInfo.fromJson(Map<String, dynamic> json) {
    return MensagemInfo(
      autorNome: json['autorNome'] as String,
      destinoRotulo: json['destinoRotulo'] as String,
      periodica: json['periodica'] as bool,
    );
  }

  final String autorNome;
  final String destinoRotulo;
  final bool periodica;
}

/// GET /notificacoes/mensagens/:mensagemId - a notificação inteira (corpo
/// completo, sem truncar) + quem enviou. Mesmo shape de
/// `NotificacaoDetalheDto` no backend.
class NotificacaoDetalhe {
  const NotificacaoDetalhe({required this.notificacao, this.mensagem});

  factory NotificacaoDetalhe.fromJson(Map<String, dynamic> json) {
    final mensagem = json['mensagem'] as Map<String, dynamic>?;
    return NotificacaoDetalhe(
      notificacao: Notificacao.fromJson(json),
      mensagem: mensagem == null ? null : MensagemInfo.fromJson(mensagem),
    );
  }

  final Notificacao notificacao;

  /// Nulo só se a mensagem original sumiu (não há exclusão hoje) - a tela
  /// ainda mostra título e texto da notificação.
  final MensagemInfo? mensagem;
}
