import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../core/auth/auth_notifier.dart';

// Nome do cookie de sessão do express-session (backend não configurou um
// nome customizado - ver src/main.ts do backend e proxy.ts do frontend
// web, que usa a mesma constante).
const _nomeCookieSessao = 'connect.sid';

/// Login via WebView embutida (OS-MOBILE-12) - o app abre `/auth/login`
/// numa WebView e deixa o fluxo OAuth2 do idp-client rodar exatamente como
/// no navegador (backend nunca muda). `returnTo` aponta pro próprio
/// `/auth/me` (endpoint que já existe) - quando a WebView chega lá, é o
/// sinal de que o login terminou; o cookie de sessão é então extraído do
/// cookie jar nativo da WebView e entregue pro [AuthNotifier] guardar.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool _processandoLogin = false;
  String? _erro;

  Uri get _urlLogin {
    final base = ApiClient.baseUrl;
    final returnTo = '$base/auth/me';
    return Uri.parse(
      '$base/auth/login?returnTo=${Uri.encodeComponent(returnTo)}',
    );
  }

  Future<void> _aoTerminarCarregamento(
    InAppWebViewController controller,
    WebUri? url,
  ) async {
    if (_processandoLogin || url == null) {
      return;
    }
    final base = ApiClient.baseUrl;
    if (!url.toString().startsWith('$base/auth/me')) {
      return;
    }

    setState(() => _processandoLogin = true);

    final cookieManager = CookieManager.instance();
    final cookies = await cookieManager.getCookies(url: WebUri(base));
    Cookie? cookieSessao;
    for (final cookie in cookies) {
      if (cookie.name == _nomeCookieSessao) {
        cookieSessao = cookie;
        break;
      }
    }

    if (cookieSessao == null) {
      setState(() {
        _processandoLogin = false;
        _erro = 'Não foi possível capturar a sessão após o login. Tente novamente.';
      });
      return;
    }

    await ref
        .read(authProvider.notifier)
        .loginConcluido('${cookieSessao.name}=${cookieSessao.value}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Entrar')),
      body: Stack(
        children: [
          InAppWebView(
            initialUrlRequest: URLRequest(url: WebUri.uri(_urlLogin)),
            onLoadStop: _aoTerminarCarregamento,
          ),
          if (_erro != null)
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Material(
                color: Colors.transparent,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(_erro!),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
