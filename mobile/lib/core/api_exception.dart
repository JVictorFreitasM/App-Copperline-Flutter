/// Erro de chamada à API - equivalente ao `ApiError` do frontend web
/// (`frontend/src/lib/api.ts`), mesmo tratamento consistente (rede
/// indisponível vs. resposta HTTP de erro) espelhado do lado mobile.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
