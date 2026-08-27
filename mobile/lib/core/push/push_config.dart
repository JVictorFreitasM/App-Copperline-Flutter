import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Categorias de notificação expostas na tela de configuração
/// (OS-MOBILE-16) - mapeiam os `TipoEventoNotificacao` reais do backend
/// (ver `EventoNotificacao`, schema.prisma) pra um rótulo que faz sentido
/// pro usuário do app; `VISITA_CANCELADA` some do enum do backend mas vira
/// aqui "Visitas da equipe" porque é o único tipo hoje endereçado a
/// supervisor (os demais são pra vendedor).
enum CategoriaNotificacao { pedidos, notasFiscais, estoque, visitasEquipe }

extension CategoriaNotificacaoLabel on CategoriaNotificacao {
  String get rotulo => switch (this) {
    CategoriaNotificacao.pedidos => 'Pedidos',
    CategoriaNotificacao.notasFiscais => 'Notas fiscais',
    CategoriaNotificacao.estoque => 'Estoque (produtos favoritados)',
    CategoriaNotificacao.visitasEquipe => 'Visitas da equipe',
  };
}

const chavePrefixoCategoriaHabilitada = 'push_categoria_habilitada_';

// Ligado por padrão (opt-out, não opt-in) - notificação é informação
// operacional relevante (pedido mudou de situação, nota rejeitada), não
// marketing; começar desligado esconderia algo que o usuário provavelmente
// quer ver sem ele saber que precisa ir ligar manualmente.
const _padraoHabilitado = true;

/// Preferência 100% local (OS-MOBILE-16, "tela simples de configuração") -
/// não existe campo no backend pra isso ainda, então só controla se o
/// dispositivo MOSTRA a notificação em FOREGROUND (ver push_service.dart) -
/// uma notificação chegando com o app em background/fechado é exibida
/// pelo próprio SO antes de qualquer código Dart rodar, então desligar uma
/// categoria aqui NÃO impede isso (limitação de FCM `notification`
/// payload, não bug desta implementação).
class PushConfigNotifier extends AsyncNotifier<Map<CategoriaNotificacao, bool>> {
  @override
  Future<Map<CategoriaNotificacao, bool>> build() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      for (final categoria in CategoriaNotificacao.values)
        categoria: prefs.getBool('$chavePrefixoCategoriaHabilitada${categoria.name}') ?? _padraoHabilitado,
    };
  }

  Future<void> definir(CategoriaNotificacao categoria, bool habilitada) async {
    final atual = await future;
    state = AsyncData({...atual, categoria: habilitada});

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$chavePrefixoCategoriaHabilitada${categoria.name}', habilitada);
  }
}

final pushConfigProvider =
    AsyncNotifierProvider<PushConfigNotifier, Map<CategoriaNotificacao, bool>>(
      PushConfigNotifier.new,
    );
