/// Mesmo shape de `backend/src/metas/meta-vendedor.service.ts`
/// (MetaProgressoDto, GET /vendedores/:id/meta-progresso, OS-BACKEND-44).
class MetaProgresso {
  const MetaProgresso({
    required this.valorMeta,
    required this.valorVendido,
    required this.percentualAtingido,
  });

  factory MetaProgresso.fromJson(Map<String, dynamic> json) {
    return MetaProgresso(
      valorMeta: (json['valorMeta'] as num?)?.toDouble(),
      valorVendido: (json['valorVendido'] as num).toDouble(),
      percentualAtingido: (json['percentualAtingido'] as num?)?.toDouble(),
    );
  }

  // null = sem meta configurada pro mes (nao "meta zero") - mesmo criterio
  // do backend.
  final double? valorMeta;
  final double valorVendido;
  final double? percentualAtingido;
}

/// Mesmo shape de `backend/src/vendedores/vendedor-vendas-semanais.service.ts`
/// (SemanaVendaDto, GET /vendedores/me/vendas-semanais, OS-MOBILE-41).
class SemanaVenda {
  const SemanaVenda({required this.semanaInicio, required this.valorVendido});

  factory SemanaVenda.fromJson(Map<String, dynamic> json) {
    return SemanaVenda(
      semanaInicio: json['semanaInicio'] as String,
      valorVendido: (json['valorVendido'] as num).toDouble(),
    );
  }

  final String semanaInicio;
  final double valorVendido;
}
