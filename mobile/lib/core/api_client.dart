import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_exception.dart';
import 'auth/idp_user.dart';
import 'auth/session_storage.dart';

// URL base da API NestJS, injetada por ambiente (flutter run/build
// --dart-define=API_BASE_URL=http://...) - nunca hardcoded (ver critério
// de aceite da OS-MOBILE-11). Sem valor padrão de propósito: rodar sem
// definir falha alto e claro em vez de silenciosamente apontar pra um host
// que pode não existir no ambiente de quem estiver rodando.
const String _apiBaseUrl = String.fromEnvironment('API_BASE_URL');

/// Subconjunto de [ApiClient] (getJson/postJsonList) usado por serviços
/// que não devem depender da classe concreta inteira (ex: `SnapshotService`/
/// `FilaPendenteService`, OS-MOBILE-22 - testáveis com um fake que
/// implementa só isso, sem precisar de `Dio`/`SessionStorage`/`API_BASE_URL`
/// reais).
abstract interface class ApiJsonClient {
  Future<Map<String, dynamic>> getJson(String path);
  Future<List<Map<String, dynamic>>> postJsonList(String path, Map<String, dynamic> corpo);
}

/// Cliente HTTP central de acesso à API NestJS - toda chamada ao backend
/// passa por aqui, nunca `Dio`/`http` solto em cada tela (mesmo papel de
/// `apiFetch` no frontend web, `frontend/src/lib/api.ts`). Anexa o cookie
/// de sessão (guardado via [SessionStorage]) em toda requisição - mesmo
/// papel do cookie `httpOnly` que o navegador enviaria sozinho no fluxo
/// web (aqui o app precisa fazer isso manualmente, ver `login_screen.dart`
/// pra como o cookie chega até aqui).
class ApiClient implements ApiJsonClient {
  ApiClient(this._sessionStorage)
    : _dio = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 15),
        ),
      ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final cookie = await _sessionStorage.lerCookie();
          if (cookie != null) {
            options.headers['cookie'] = cookie;
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  final SessionStorage _sessionStorage;

  static String get baseUrl {
    if (_apiBaseUrl.isEmpty) {
      throw StateError(
        'API_BASE_URL não configurada - rode com '
        '--dart-define=API_BASE_URL=http://<host>:3010 '
        '(ver README do projeto mobile).',
      );
    }
    return _apiBaseUrl;
  }

  @override
  Future<Map<String, dynamic>> getJson(String path) async {
    try {
      final resposta = await _dio.get<Map<String, dynamic>>(path);
      return resposta.data ?? <String, dynamic>{};
    } on DioException catch (erro) {
      throw ApiException(
        _mensagemErro(erro),
        statusCode: erro.response?.statusCode,
      );
    }
  }

  // Endpoints que respondem um array JSON na raiz (ex: GET /visitas/minhas,
  // OS-MOBILE-17), diferente de getJson (objeto na raiz).
  Future<List<Map<String, dynamic>>> getJsonList(String path) async {
    try {
      final resposta = await _dio.get<List<dynamic>>(path);
      return (resposta.data ?? const []).cast<Map<String, dynamic>>();
    } on DioException catch (erro) {
      throw ApiException(
        _mensagemErro(erro),
        statusCode: erro.response?.statusCode,
      );
    }
  }

  // Primeiro POST do app (OS-MOBILE-16, registro de dispositivo pra push) -
  // resposta pode vir vazia (ex: 204 No Content, como POST /dispositivos),
  // por isso Map vazio como default em vez de exigir corpo.
  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> corpo) async {
    try {
      final resposta = await _dio.post<Map<String, dynamic>>(path, data: corpo);
      return resposta.data ?? <String, dynamic>{};
    } on DioException catch (erro) {
      throw ApiException(
        _mensagemErro(erro),
        statusCode: erro.response?.statusCode,
      );
    }
  }

  // PATCH /clientes/:id/localizacao (OS-MOBILE-21, fecha uma lacuna da
  // OS-MOBILE-17 - roteiro_screen.dart já orientava "defina o pin no
  // detalhe do cliente", mas não existia como fazer isso no app).
  Future<Map<String, dynamic>> patchJson(String path, Map<String, dynamic> corpo) async {
    try {
      final resposta = await _dio.patch<Map<String, dynamic>>(path, data: corpo);
      return resposta.data ?? <String, dynamic>{};
    } on DioException catch (erro) {
      throw ApiException(
        _mensagemErro(erro),
        statusCode: erro.response?.statusCode,
      );
    }
  }

  // POST multipart/form-data (foto + campos de texto) - só o check-in de
  // visita usa isso hoje (OS-MOBILE-21, ver VisitasController.checkin no
  // backend, que exige FileInterceptor('foto')). `campos` vira FormData com
  // valores stringificados (mesmo formato que o Nest espera de multipart -
  // class-transformer converte de volta pro tipo real via @Type()).
  Future<Map<String, dynamic>> postMultipart(
    String path,
    Map<String, String> campos,
    String caminhoArquivo,
  ) async {
    try {
      final formData = FormData.fromMap({
        ...campos,
        'foto': await MultipartFile.fromFile(caminhoArquivo, filename: 'checkin.jpg'),
      });
      final resposta = await _dio.post<Map<String, dynamic>>(path, data: formData);
      return resposta.data ?? <String, dynamic>{};
    } on DioException catch (erro) {
      throw ApiException(
        _mensagemErro(erro),
        statusCode: erro.response?.statusCode,
      );
    }
  }

  // POST que responde array na raiz (ex: POST /mobile/fila-pendente,
  // OS-MOBILE-22 - ResultadoAcaoFilaDto[]).
  @override
  Future<List<Map<String, dynamic>>> postJsonList(
    String path,
    Map<String, dynamic> corpo,
  ) async {
    try {
      final resposta = await _dio.post<List<dynamic>>(path, data: corpo);
      return (resposta.data ?? const []).cast<Map<String, dynamic>>();
    } on DioException catch (erro) {
      throw ApiException(
        _mensagemErro(erro),
        statusCode: erro.response?.statusCode,
      );
    }
  }

  // /auth/me usa requireAuth "puro" do idp-client (redireciona pro login
  // quando não há sessão, nunca 401 - ver backend/src/auth/auth.module.ts)
  // - diferente dos endpoints de negócio, que usam RequireSessionMiddleware
  // (401). followRedirects:false + validateStatus aceitando <400 evita que
  // o Dio siga o redirect e tente parsear a página de login como JSON.
  Future<IdpUser?> obterUsuarioAtual() async {
    final resposta = await _dio.get<Map<String, dynamic>>(
      '/auth/me',
      options: Options(
        followRedirects: false,
        validateStatus: (status) => status != null && status < 400,
      ),
    );
    if (resposta.statusCode == null || resposta.statusCode! >= 300) {
      return null;
    }
    if (resposta.data == null) {
      return null;
    }
    return IdpUser.fromJson(resposta.data!);
  }

  String _mensagemErro(DioException erro) {
    if (erro.type == DioExceptionType.connectionTimeout ||
        erro.type == DioExceptionType.receiveTimeout ||
        erro.type == DioExceptionType.sendTimeout) {
      return 'Tempo de conexão com a API esgotado.';
    }
    if (erro.response != null) {
      return _mensagemDoCorpo(erro.response!.data) ??
          'API respondeu ${erro.response!.statusCode} para ${erro.requestOptions.path}';
    }
    return 'Falha ao conectar com a API: ${erro.message}';
  }

  // NestJS devolve {message, error, statusCode} no corpo de erro -
  // `message` pode ser string (ex: ForbiddenException) ou array de string
  // (ValidationPipe, um item por campo inválido). Sem isso, todo erro de
  // negócio (raio de 50m, EXIF ausente, visita em aberto, etc.) virava só
  // "API respondeu 400/403", escondendo a causa real do usuário.
  String? _mensagemDoCorpo(dynamic corpo) {
    if (corpo is! Map) return null;
    final mensagem = corpo['message'];
    if (mensagem is String) return mensagem;
    if (mensagem is List) return mensagem.join('; ');
    return null;
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(sessionStorageProvider));
});
