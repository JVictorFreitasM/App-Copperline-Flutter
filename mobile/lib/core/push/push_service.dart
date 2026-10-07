import '../providers/sincronizacao_provider.dart';
import 'dart:async';
import 'dart:io' show Platform;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api_client.dart';
import 'push_config.dart';
import 'push_navigation.dart';

/// Handler de mensagem em background/terminado (OS-MOBILE-16) - função
/// TOP-LEVEL exigida pelo firebase_messaging (roda num isolate separado,
/// sem acesso a estado do app/Riverpod). Só logging - o SO já mostra a
/// notificação sozinho a partir do payload `notification` (nada a fazer
/// aqui além de permitir que o FCM SDK processe a mensagem); navegação ao
/// TOCAR na notificação é tratada por `onMessageOpenedApp`/
/// `getInitialMessage` em [PushService.inicializar], não aqui.
@pragma('vm:entry-point')
Future<void> tratarMensagemEmBackground(RemoteMessage mensagem) async {}

/// Registro de token + navegação ao toque (OS-MOBILE-16). Chamado uma vez
/// por sessão logada (ver `auth_gate.dart`, `ref.listen` no
/// `authProvider`) - reenviar o token no login é intencional mesmo se já
/// registrado antes (token pode ter mudado, e o backend faz upsert por
/// token, ver `DispositivosService`).
class PushService {
  PushService(this._apiClient, {this.aoReceberEmPrimeiroPlano});

  final ApiClient _apiClient;

  /// Chamado quando chega uma notificação com o app ABERTO - serve pra as telas
  /// (pedido aprovado/recusado no web, nova aprovação...) recarregarem sozinhas
  /// em vez de ficarem mostrando o valor antigo.
  final void Function()? aoReceberEmPrimeiroPlano;

  // Um só listener de renovação de token: `inicializar` roda a cada login, e
  // sem guardar a assinatura cada login empilhava mais um listener (cada
  // renovação passava a registrar o token N vezes).
  StreamSubscription<String>? _assinaturaRenovacaoToken;

  Future<void> inicializar() async {
    final permissao = await FirebaseMessaging.instance.requestPermission();
    if (permissao.authorizationStatus == AuthorizationStatus.denied) {
      // Usuário negou a permissão do SO - respeitar, não insistir (sem
      // retry automático nem tela bloqueando o app por causa disso).
      return;
    }

    await _registrarToken();
    await _assinaturaRenovacaoToken?.cancel();
    _assinaturaRenovacaoToken = FirebaseMessaging.instance.onTokenRefresh.listen((_) => _registrarToken());

    FirebaseMessaging.onBackgroundMessage(tratarMensagemEmBackground);

    // Foreground: o SO NÃO mostra notificação sozinho pra payload
    // `notification` (diferente de background/terminado) - banner próprio
    // via SnackBar, respeitando a categoria desligada localmente (única
    // camada onde essa preferência realmente se aplica, ver
    // push_config.dart).
    FirebaseMessaging.onMessage.listen(_mostrarBannerForeground);

    // Toque leva o app de background pra foreground (app já rodando).
    FirebaseMessaging.onMessageOpenedApp.listen(
      (mensagem) => navegarParaNotificacao(mensagem.data),
    );

    // App foi aberto DIRETO pelo toque na notificação (estava terminado) -
    // getInitialMessage só retorna algo nesse cold-start específico.
    final mensagemInicial = await FirebaseMessaging.instance.getInitialMessage();
    if (mensagemInicial != null) {
      navegarParaNotificacao(mensagemInicial.data);
    }
  }

  Future<void> _registrarToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) {
        return;
      }
      final plataforma = Platform.isIOS ? 'IOS' : 'ANDROID';
      await _apiClient.postJson('/dispositivos', {'token': token, 'plataforma': plataforma});
    } catch (_) {
      // Sem rede/sessão agora (ex: renovação de token logo depois do logout) -
      // o próximo login registra de novo. Erro aqui nunca pode virar exceção
      // não tratada num listener.
    }
  }

  /// Logout: tira ESTE aparelho de quem recebe push (o servidor só remove token
  /// da própria conta) e invalida o token local. Sem isso, quem saiu da conta
  /// continuava recebendo as notificações dela no celular. Melhor esforço e com
  /// limite de tempo: logout nunca fica preso por falta de rede - se o servidor
  /// não for avisado, o token invalidado localmente vira "não registrado" no
  /// Firebase e o backend o apaga no próximo envio.
  Future<void> desregistrar() async {
    try {
      await _assinaturaRenovacaoToken?.cancel();
      _assinaturaRenovacaoToken = null;
      await _desregistrarNoServidorEFirebase().timeout(const Duration(seconds: 5));
    } catch (_) {
      // Ver comentário acima.
    }
  }

  Future<void> _desregistrarNoServidorEFirebase() async {
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) {
      await _apiClient.postJson('/dispositivos/remover', {'token': token});
    }
    await FirebaseMessaging.instance.deleteToken();
  }

  Future<void> _mostrarBannerForeground(RemoteMessage mensagem) async {
    // Recarrega as telas mesmo se o banner estiver desligado nas preferências
    // (preferência é só do aviso visual, não do dado).
    aoReceberEmPrimeiroPlano?.call();

    final categoria = categoriaDoPayload(mensagem.data);
    if (categoria != null && !await _categoriaHabilitada(categoria)) {
      return;
    }

    final titulo = mensagem.notification?.title;
    final corpo = mensagem.notification?.body;
    if (titulo == null && corpo == null) {
      return;
    }

    final context = navigatorKey.currentContext;
    if (context == null || !context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text([titulo, corpo].whereType<String>().join(' · ')),
        action: SnackBarAction(
          label: 'Ver',
          onPressed: () => navegarParaNotificacao(mensagem.data),
        ),
      ),
    );
  }

  // Le a preferencia direto do SharedPreferences (este service nao e' um
  // Notifier/nao tem Ref) - mesma chave gravada por PushConfigNotifier
  // (ver push_config.dart, `_chavePrefixo`).
  Future<bool> _categoriaHabilitada(CategoriaNotificacao categoria) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('$chavePrefixoCategoriaHabilitada${categoria.name}') ?? true;
  }
}

final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(
    ref.watch(apiClientProvider),
    aoReceberEmPrimeiroPlano: () => ref.read(sincronizacaoProvider.notifier).recarregarTelas(),
  );
});
