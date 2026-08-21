import 'dart:async';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';

/// Encerra a sessão no servidor abrindo `/auth/logout` numa WebView sem
/// interface (`HeadlessInAppWebView`) - sem isso, o logout só limparia o
/// cookie local, deixando a sessão do IdP viva (o SSO reautenticaria
/// silenciosamente no próximo login, ver skill `idp-client`, seção "Modelo
/// do Fluxo", passo 5). O cookie de sessão já está no cookie jar nativo da
/// WebView desde o login (compartilhado entre instâncias no mesmo app),
/// não precisa ser repassado manualmente aqui.
class LogoutService {
  Future<void> encerrarSessaoNoServidor() async {
    final concluido = Completer<void>();
    late final HeadlessInAppWebView headlessWebView;

    headlessWebView = HeadlessInAppWebView(
      initialUrlRequest: URLRequest(
        url: WebUri('${ApiClient.baseUrl}/auth/logout'),
      ),
      onLoadStop: (controller, url) {
        if (!concluido.isCompleted) {
          concluido.complete();
        }
      },
    );

    await headlessWebView.run();
    try {
      await concluido.future.timeout(const Duration(seconds: 8));
    } catch (_) {
      // Melhor esforço - se o redirect não terminar a tempo, ainda assim
      // seguimos com o logout local (mesmo espírito best-effort do
      // idp-client pro lado do IdP).
    } finally {
      await headlessWebView.dispose();
    }
  }
}

final logoutServiceProvider = Provider<LogoutService>((ref) => LogoutService());
