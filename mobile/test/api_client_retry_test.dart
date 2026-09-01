import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:copperline_mobile/core/api_client.dart';
import 'package:copperline_mobile/core/api_exception.dart';

// Rodar com --dart-define=API_BASE_URL=http://teste.local (mesmo valor do
// baseUrl do Dio fake abaixo) - os testes de mensagem de SocketException
// chamam ApiClient.baseUrl (usado no texto da mensagem), que lança
// StateError se a env var não estiver definida (ver api_client.dart).
//
// OS-MOBILE-31/33: cobre o retry com backoff (leitura) e a mensagem
// específica por subtipo de SocketException - ambos adicionados nesta
// rodada. Usa um HttpClientAdapter fake em vez de bater numa API real
// (ApiClient.paraTeste, seam adicionada só pra isso).
void main() {
  test('getJson tenta de novo em falha transitória e retorna no sucesso seguinte', () async {
    final adapter = _AdapterFake([
      _falhaConexao(DioExceptionType.connectionTimeout),
      _falhaConexao(DioExceptionType.connectionTimeout),
      _respostaOk({'ok': true}),
    ]);
    final apiClient = ApiClient.paraTeste(_dioComAdapter(adapter));

    final resultado = await apiClient.getJson('/qualquer');

    expect(resultado, {'ok': true});
    expect(adapter.chamadas, 3);
  });

  test('getJson desiste após esgotar as tentativas e propaga ApiException', () async {
    final adapter = _AdapterFake([
      _falhaConexao(DioExceptionType.connectionTimeout),
      _falhaConexao(DioExceptionType.connectionTimeout),
      _falhaConexao(DioExceptionType.connectionTimeout),
    ]);
    final apiClient = ApiClient.paraTeste(_dioComAdapter(adapter));

    await expectLater(
      apiClient.getJson('/qualquer'),
      throwsA(isA<ApiException>()),
    );
    expect(adapter.chamadas, 3);
  });

  test('erro de negócio (resposta 400) não é retentado', () async {
    final adapter = _AdapterFake([
      _respostaErro(400, {'message': 'Fora do raio máximo'}),
    ]);
    final apiClient = ApiClient.paraTeste(_dioComAdapter(adapter));

    await expectLater(
      apiClient.getJson('/qualquer'),
      throwsA(
        isA<ApiException>().having((e) => e.message, 'message', 'Fora do raio máximo'),
      ),
    );
    expect(adapter.chamadas, 1);
  });

  test('SocketException "Connection refused" vira mensagem específica', () async {
    final adapter = _AdapterFake(
      List.generate(3, (_) => _falhaSocket('Connection refused')),
    );
    final apiClient = ApiClient.paraTeste(_dioComAdapter(adapter));

    await expectLater(
      apiClient.getJson('/qualquer'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('Conexão recusada'),
        ),
      ),
    );
  });

  test('SocketException "No route to host" vira mensagem específica', () async {
    final adapter = _AdapterFake(
      List.generate(3, (_) => _falhaSocket('No route to host')),
    );
    final apiClient = ApiClient.paraTeste(_dioComAdapter(adapter));

    await expectLater(
      apiClient.getJson('/qualquer'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('alcançar'),
        ),
      ),
    );
  });
}

Dio _dioComAdapter(HttpClientAdapter adapter) {
  final dio = Dio(BaseOptions(baseUrl: 'http://teste.local'));
  dio.httpClientAdapter = adapter;
  return dio;
}

_RespostaFake _falhaConexao(DioExceptionType tipo) => _RespostaFake.excecao(tipo: tipo);

_RespostaFake _falhaSocket(String mensagemOs) => _RespostaFake.excecao(
  tipo: DioExceptionType.connectionError,
  erroInterno: SocketException('Falha de socket', osError: OSError(mensagemOs)),
);

_RespostaFake _respostaOk(Map<String, dynamic> corpo) => _RespostaFake.sucesso(200, corpo);

_RespostaFake _respostaErro(int status, Map<String, dynamic> corpo) =>
    _RespostaFake.sucesso(status, corpo);

class _RespostaFake {
  _RespostaFake.sucesso(this.status, this.corpo) : tipoExcecao = null, erroInterno = null;
  _RespostaFake.excecao({required DioExceptionType tipo, this.erroInterno})
    : status = null,
      corpo = null,
      tipoExcecao = tipo;

  final int? status;
  final Map<String, dynamic>? corpo;
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
    final resposta = _respostas[chamadas];
    chamadas++;
    if (resposta.tipoExcecao != null) {
      throw DioException(
        requestOptions: options,
        type: resposta.tipoExcecao!,
        error: resposta.erroInterno,
      );
    }
    final bytes = utf8.encode(jsonEncode(resposta.corpo));
    return ResponseBody.fromBytes(bytes, resposta.status!, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}
