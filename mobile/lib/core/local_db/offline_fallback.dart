import '../pagination.dart';

/// Pagina/filtra client-side sobre o espelho local (OS-MOBILE-22,
/// critério de aceite: "app funciona para leitura totalmente offline após
/// o primeiro snapshot") - só usado como FALLBACK quando a chamada de
/// rede falha (ver clientes_provider.dart/produtos_provider.dart/
/// pedidos_provider.dart), nunca como caminho principal (filtro/paginação
/// "de verdade" sempre vem do backend quando há rede).
PaginatedResult<T> filtrarEPaginarLocal<T>({
  required List<T> todos,
  required int pagina,
  required int limite,
  required bool Function(T item) filtro,
}) {
  final filtrados = todos.where(filtro).toList();
  final totalPages = filtrados.isEmpty ? 1 : (filtrados.length / limite).ceil();
  final inicio = (pagina - 1) * limite;
  final itensDaPagina = inicio >= filtrados.length
      ? <T>[]
      : filtrados.sublist(inicio, (inicio + limite).clamp(0, filtrados.length));

  return PaginatedResult(data: itensDaPagina, page: pagina, totalPages: totalPages);
}
