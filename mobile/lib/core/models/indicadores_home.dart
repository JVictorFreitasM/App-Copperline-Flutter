/// Mesmo shape de `backend/src/metas/meta-vendedor.service.ts`
/// (MetaProgressoDto, GET /vendedores/:id/meta-progresso, OS-BACKEND-44).
/// Pedido do usuário (2026-09-29): tipoMeta (Dinheiro/Peso/Margem, ver
/// tipoMeta abaixo) e periodicidade (Mensal/Semanal, que podem coexistir -
/// ver indicadores_home_provider.dart, dois providers separados) entraram
/// no shape do backend. Margem ainda não tem cálculo de progresso
/// implementado - valorVendido sempre 0, percentualAtingido sempre null
/// pra esse tipo (mesmo critério do backend).
class MetaProgresso {
  const MetaProgresso({
    required this.periodicidade,
    required this.periodo,
    required this.tipoMeta,
    required this.valorMeta,
    required this.valorVendido,
    required this.percentualAtingido,
  });

  factory MetaProgresso.fromJson(Map<String, dynamic> json) {
    return MetaProgresso(
      periodicidade: json['periodicidade'] as String,
      periodo: json['periodo'] as String,
      tipoMeta: json['tipoMeta'] as String?,
      valorMeta: (json['valorMeta'] as num?)?.toDouble(),
      valorVendido: (json['valorVendido'] as num).toDouble(),
      percentualAtingido: (json['percentualAtingido'] as num?)?.toDouble(),
    );
  }

  final String periodicidade; // "MENSAL" | "SEMANAL"
  final String periodo;
  // null = sem meta configurada pro período (nao "meta zero") - mesmo
  // criterio do backend. "DINHEIRO" | "PESO" | "MARGEM" quando presente.
  final String? tipoMeta;
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
