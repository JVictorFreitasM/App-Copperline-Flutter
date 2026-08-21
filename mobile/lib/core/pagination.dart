/// Mesmo shape de `backend/src/common/pagination.ts` (`PaginatedResult`) -
/// duplicado aqui por não haver pacote compartilhado entre mobile e back
/// (mesmo padrão já usado no web, `frontend/src/lib/pagination.ts`).
class PaginatedResult<T> {
  const PaginatedResult({
    required this.data,
    required this.page,
    required this.totalPages,
  });

  factory PaginatedResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) itemFromJson,
  ) {
    final meta = json['meta'] as Map<String, dynamic>;
    return PaginatedResult(
      data: (json['data'] as List)
          .cast<Map<String, dynamic>>()
          .map(itemFromJson)
          .toList(),
      page: meta['page'] as int,
      totalPages: meta['totalPages'] as int,
    );
  }

  final List<T> data;
  final int page;
  final int totalPages;
}
