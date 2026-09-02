/// Mesmo shape de `backend/src/documentos/dto/documento-response.dto.ts`
/// (OS-BACKEND-41).
class DocumentoResumo {
  const DocumentoResumo({
    required this.id,
    required this.nome,
    required this.categoria,
    required this.tipoMime,
    required this.tamanhoBytes,
    required this.enviadoPor,
    required this.criadoEm,
  });

  factory DocumentoResumo.fromJson(Map<String, dynamic> json) {
    return DocumentoResumo(
      id: json['id'] as String,
      nome: json['nome'] as String,
      categoria: json['categoria'] as String,
      tipoMime: json['tipoMime'] as String,
      tamanhoBytes: json['tamanhoBytes'] as int,
      enviadoPor: json['enviadoPor'] as String,
      criadoEm: DateTime.parse(json['criadoEm'] as String),
    );
  }

  final String id;
  final String nome;
  final String categoria;
  final String tipoMime;
  final int tamanhoBytes;
  final String enviadoPor;
  final DateTime criadoEm;
}
