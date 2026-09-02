import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:copperline_mobile/core/api_client.dart';
import 'package:copperline_mobile/core/auth/auth_notifier.dart';
import 'package:copperline_mobile/core/auth/session_storage.dart';

// OS-MOBILE-38 (inicialização offline-first) - cobre a decisão central:
// com cache local válido, libera a tela IMEDIATAMENTE (sem esperar rede),
// revalida em segundo plano, e só desloga de verdade quando o SERVIDOR
// confirma sessão inválida (nunca por falha de rede na revalidação).
void main() {
  test('sem cookie salvo, retorna nao-autenticado sem chamar rede', () async {
    final container = ProviderContainer(
      overrides: [
        sessionStorageProvider.overrideWithValue(_SessionStorageFake()),
        apiClientProvider.overrideWithValue(
          ApiClient.paraTeste(_dioComAdapter(_AdapterFake([]))),
        ),
      ],
    );
    addTearDown(container.dispose);

    final estado = await container.read(authProvider.future);

    expect(estado.autenticado, isFalse);
  });

  test('cookie + cache valido libera a tela com o usuario cacheado, sem bloquear', () async {
    final storage = _SessionStorageFake()
      ..dados['cookie'] = 'connect.sid=abc'
      ..dados['usuario'] = jsonEncode({
        'sub': 'u1',
        'email': 'a@b.com',
        'name': 'Fulana',
        'role': null,
        'system': 'mobile',
      })
      ..dados['validadoEm'] = DateTime.now().toIso8601String();
    final adapter = _AdapterFake([_respostaOk({'sub': 'u1', 'email': 'a@b.com', 'name': 'Fulana', 'role': null, 'system': 'mobile'})]);
    final container = ProviderContainer(
      overrides: [
        sessionStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(
          ApiClient.paraTeste(_dioComAdapter(adapter)),
        ),
      ],
    );
    addTearDown(container.dispose);

    final estado = await container.read(authProvider.future);

    expect(estado.autenticado, isTrue);
    expect(estado.usuario!.name, 'Fulana');
    expect(estado.usandoCacheOffline, isTrue);

    // Deixa a revalidação em segundo plano (unawaited em build()) terminar
    // antes do container ser descartado no tearDown - senão ela tenta
    // escrever em `state` depois do dispose (ver ref.mounted no notifier).
    await Future<void>.delayed(const Duration(milliseconds: 50));
  });

  test('revalidacao em segundo plano falha por rede - mantem o cache, nao desloga', () async {
    final storage = _SessionStorageFake()
      ..dados['cookie'] = 'connect.sid=abc'
      ..dados['usuario'] = jsonEncode({
        'sub': 'u1',
        'email': 'a@b.com',
        'name': 'Fulana',
        'role': null,
        'system': 'mobile',
      })
      ..dados['validadoEm'] = DateTime.now().toIso8601String();
    final adapter = _AdapterFake([_falhaConexao()]);
    final container = ProviderContainer(
      overrides: [
        sessionStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(
          ApiClient.paraTeste(_dioComAdapter(adapter)),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authProvider.future);
    await Future<void>.delayed(const Duration(milliseconds: 50));

    final estadoFinal = container.read(authProvider).value!;
    expect(estadoFinal.autenticado, isTrue);
    expect(estadoFinal.usuario!.name, 'Fulana');
  });

  test('revalidacao em segundo plano confirma sessao invalida - desloga de verdade', () async {
    final storage = _SessionStorageFake()
      ..dados['cookie'] = 'connect.sid=abc'
      ..dados['usuario'] = jsonEncode({
        'sub': 'u1',
        'email': 'a@b.com',
        'name': 'Fulana',
        'role': null,
        'system': 'mobile',
      })
      ..dados['validadoEm'] = DateTime.now().toIso8601String();
    // /auth/me devolvendo 3xx = requireAuth "puro" indicando sessao
    // realmente invalida (nao falha de rede) - ver api_client.dart.
    final adapter = _AdapterFake([_RespostaFake.textoBruto(302, 'Found')]);
    final container = ProviderContainer(
      overrides: [
        sessionStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(
          ApiClient.paraTeste(_dioComAdapter(adapter)),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authProvider.future);
    await Future<void>.delayed(const Duration(milliseconds: 50));

    final estadoFinal = container.read(authProvider).value!;
    expect(estadoFinal.autenticado, isFalse);
    expect(storage.dados.containsKey('cookie'), isFalse);
  });

  test('tolerancia vencida sem rede - exige login (nao confia no cache indefinidamente)', () async {
    final storage = _SessionStorageFake()
      ..dados['cookie'] = 'connect.sid=abc'
      ..dados['usuario'] = jsonEncode({
        'sub': 'u1',
        'email': 'a@b.com',
        'name': 'Fulana',
        'role': null,
        'system': 'mobile',
      })
      ..dados['validadoEm'] = DateTime.now().subtract(const Duration(days: 8)).toIso8601String();
    final adapter = _AdapterFake([_falhaConexao()]);
    final container = ProviderContainer(
      overrides: [
        sessionStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(
          ApiClient.paraTeste(_dioComAdapter(adapter)),
        ),
      ],
    );
    addTearDown(container.dispose);

    final estado = await container.read(authProvider.future);

    expect(estado.autenticado, isFalse);
  });
}

class _SessionStorageFake extends SessionStorage {
  _SessionStorageFake() : super(const FlutterSecureStorage());

  final Map<String, String> dados = {};

  @override
  Future<void> salvarCookie(String cookie) async => dados['cookie'] = cookie;

  @override
  Future<String?> lerCookie() async => dados['cookie'];

  @override
  Future<void> salvarUsuarioCache(String usuarioJson) async => dados['usuario'] = usuarioJson;

  @override
  Future<String?> lerUsuarioCache() async => dados['usuario'];

  @override
  Future<void> salvarValidadoEm(DateTime data) async =>
      dados['validadoEm'] = data.toIso8601String();

  @override
  Future<DateTime?> lerValidadoEm() async {
    final valor = dados['validadoEm'];
    return valor == null ? null : DateTime.tryParse(valor);
  }

  @override
  Future<void> limpar() async {
    dados.remove('cookie');
    dados.remove('usuario');
    dados.remove('validadoEm');
  }
}

Dio _dioComAdapter(HttpClientAdapter adapter) {
  final dio = Dio(BaseOptions(baseUrl: 'http://teste.local'));
  dio.httpClientAdapter = adapter;
  return dio;
}

_RespostaFake _respostaOk(Map<String, dynamic> corpo) => _RespostaFake.sucesso(200, corpo);

_RespostaFake _falhaConexao() =>
    _RespostaFake.excecao(tipo: DioExceptionType.connectionError, erroInterno: const SocketException('sem rede'));

class _RespostaFake {
  _RespostaFake.sucesso(this.status, this.corpo)
    : tipoExcecao = null,
      erroInterno = null,
      corpoBruto = null;
  _RespostaFake.excecao({required DioExceptionType tipo, this.erroInterno})
    : status = null,
      corpo = null,
      corpoBruto = null,
      tipoExcecao = tipo;
  _RespostaFake.textoBruto(this.status, this.corpoBruto)
    : corpo = null,
      tipoExcecao = null,
      erroInterno = null;

  final int? status;
  final Map<String, dynamic>? corpo;
  final String? corpoBruto;
  final DioExceptionType? tipoExcecao;
  final Object? erroInterno;
}

class _AdapterFake implements HttpClientAdapter {
  _AdapterFake(this._respostas);

  final List<_RespostaFake> _respostas;
  int chamadas = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final resposta = _respostas[chamadas < _respostas.length ? chamadas : _respostas.length - 1];
    chamadas++;
    if (resposta.tipoExcecao != null) {
      throw DioException(
        requestOptions: options,
        type: resposta.tipoExcecao!,
        error: resposta.erroInterno,
      );
    }
    if (resposta.corpoBruto != null) {
      final bytes = utf8.encode(resposta.corpoBruto!);
      return ResponseBody.fromBytes(bytes, resposta.status!, headers: {
        Headers.contentTypeHeader: ['text/html'],
      });
    }
    final bytes = utf8.encode(jsonEncode(resposta.corpo));
    return ResponseBody.fromBytes(bytes, resposta.status!, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}
