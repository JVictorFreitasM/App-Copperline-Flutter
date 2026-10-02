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
