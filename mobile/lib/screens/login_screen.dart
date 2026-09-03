import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../core/auth/auth_notifier.dart';
import '../widgets/listagem_feedback.dart';

// Nome do cookie de sessão do express-session (backend não configurou um
// nome customizado - ver src/main.ts do backend e proxy.ts do frontend
// web, que usa a mesma constante).
const _nomeCookieSessao = 'connect.sid';

// OS-MOBILE-28: se o fluxo inteiro (login -> IdP -> callback -> /auth/me)
// não terminar dentro desse prazo, trata como timeout em vez de deixar a
// WebView em branco/carregando indefinidamente.
const _timeoutCarregamento = Duration(seconds: 25);

/// Login via WebView embutida (OS-MOBILE-12) - o app abre `/auth/login`
/// numa WebView e deixa o fluxo OAuth2 do idp-client rodar exatamente como
/// no navegador (backend nunca muda). `returnTo` aponta pro próprio
/// `/auth/me` (endpoint que já existe) - quando a WebView chega lá, é o
/// sinal de que o login terminou; o cookie de sessão é então extraído do
/// cookie jar nativo da WebView e entregue pro [AuthNotifier] guardar.
///
/// OS-MOBILE-28 (só Android, sem versão iOS do app): erro de carregamento
/// (sem internet, timeout, erro do servidor de auth) mostra uma tela de
/// erro do próprio app em vez da tela de erro nativa do navegador/WebView.
/// "Camuflagem" de chrome de navegador já é estrutural aqui - InAppWebView
/// embutida numa Scaffold própria nunca mostra barra de URL/navegação,
/// diferente de abrir um browser externo/Custom Tab.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool _processandoLogin = false;
  String? _erroCaptura;
  String? _erroCarregamento;
  Timer? _timeoutTimer;
  // Muda a cada "tentar novamente" pra forçar o InAppWebView a remontar do
  // zero (recarrega initialUrlRequest) - controller.reload() reexecutaria
  // a MESMA URL que já falhou, sem reconstruir o estado interno da WebView.
  int _tentativa = 0;

  Uri get _urlLogin {
    final base = ApiClient.baseUrl;
    final returnTo = '$base/auth/me';
    return Uri.parse(
      '$base/auth/login?returnTo=${Uri.encodeComponent(returnTo)}',
    );
  }

  @override
  void initState() {
    super.initState();
    _iniciarTimeoutTimer();
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    super.dispose();
  }

  void _iniciarTimeoutTimer() {
    _timeoutTimer?.cancel();
    _timeoutTimer = Timer(_timeoutCarregamento, () {
      if (!mounted || _erroCarregamento != null || _processandoLogin) return;
      setState(() {
        _erroCarregamento = 'O login demorou demais para carregar.';
      });
    });
  }

  void _tentarNovamente() {
    setState(() {
      _erroCarregamento = null;
      _erroCaptura = null;
      _processandoLogin = false;
      _tentativa++;
    });
    _iniciarTimeoutTimer();
  }

  void _aoReceberErro(WebResourceRequest request, WebResourceError error) {
    if (request.isForMainFrame != true || !mounted || _erroCarregamento != null) {
      return;
    }
    _timeoutTimer?.cancel();
    setState(() => _erroCarregamento = _mensagemErroWebView(error.type));
  }

  void _aoReceberErroHttp(WebResourceRequest request, WebResourceResponse errorResponse) {
    if (request.isForMainFrame != true || !mounted || _erroCarregamento != null) {
      return;
    }
    _timeoutTimer?.cancel();
    setState(() {
      _erroCarregamento =
          'O servidor de login respondeu com erro (${errorResponse.statusCode}).';
    });
  }

  // WebResourceErrorType não é um enum simples (é uma classe "multi-
  // platform const" - ver flutter_inappwebview_platform_interface), por
  // isso comparação com == em vez de switch/case (o analyzer rejeita esses
  // valores como constant pattern).
  String _mensagemErroWebView(WebResourceErrorType? tipo) {
    if (tipo == WebResourceErrorType.NOT_CONNECTED_TO_INTERNET ||
        tipo == WebResourceErrorType.NETWORK_CONNECTION_LOST) {
      return 'Sem conexão com a internet.';
    }
    if (tipo == WebResourceErrorType.HOST_LOOKUP ||
        tipo == WebResourceErrorType.CANNOT_CONNECT_TO_HOST) {
      return 'Não foi possível alcançar o servidor de login.';
    }
    if (tipo == WebResourceErrorType.TIMEOUT) {
      return 'O login demorou demais para carregar.';
    }
    return 'Não foi possível carregar a tela de login.';
  }

  Future<void> _aoTerminarCarregamento(
    InAppWebViewController controller,
    WebUri? url,
  ) async {
    if (_processandoLogin || url == null || _erroCarregamento != null) {
      return;
    }
    final base = ApiClient.baseUrl;
    if (!url.toString().startsWith('$base/auth/me')) {
      // Pagina intermediaria carregou com sucesso (ex: formulario de login
      // do IdP) - reinicia o timeout aqui em vez de deixar o timer original
      // (armado desde o initState) continuar contando. Bug real: sem isso,
      // o tempo que o usuario leva DIGITANDO email/senha contava como se
      // fosse falha de carregamento - o timer disparava no meio do
      // preenchimento, derrubando a WebView inteira (e os campos digitados
      // junto) mesmo com a pagina carregada e funcionando normalmente.
      _iniciarTimeoutTimer();
      return;
    }

    _timeoutTimer?.cancel();
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
        _erroCaptura = 'Não foi possível capturar a sessão após o login. Tente novamente.';
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
      body: _erroCarregamento != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: ErroConexao(
                  titulo: 'Não foi possível carregar o login',
                  mensagem: _erroCarregamento!,
                  aoTentarNovamente: _tentarNovamente,
                ),
              ),
            )
          : Stack(
              children: [
                InAppWebView(
                  key: ValueKey(_tentativa),
                  initialUrlRequest: URLRequest(url: WebUri.uri(_urlLogin)),
                  onLoadStop: _aoTerminarCarregamento,
                  onReceivedError: (controller, request, error) =>
                      _aoReceberErro(request, error),
                  onReceivedHttpError: (controller, request, errorResponse) =>
                      _aoReceberErroHttp(request, errorResponse),
                ),
                if (_erroCaptura != null)
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
                        child: Text(_erroCaptura!),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
