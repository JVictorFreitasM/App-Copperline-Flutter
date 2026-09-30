/// Mesmo shape de `backend/src/coberturas/cobertura-temporaria.service.ts`
/// (CoberturaTemporariaDto) - duplicado aqui por não haver pacote
/// compartilhado entre mobile e back (mesmo padrão do web,
/// `frontend/src/lib/coberturas.ts`).
class CoberturaTemporaria {
  const CoberturaTemporaria({
    required this.id,
    required this.vendedorOriginalNome,
    required this.dataInicio,
    required this.dataFim,
    required this.ativa,
  });

  factory CoberturaTemporaria.fromJson(Map<String, dynamic> json) {
    return CoberturaTemporaria(
      id: json['id'] as String,
      vendedorOriginalNome: json['vendedorOriginalNome'] as String?,
      dataInicio: json['dataInicio'] as String,
      dataFim: json['dataFim'] as String,
      ativa: json['ativa'] as bool,
    );
  }

  final String id;
  final String? vendedorOriginalNome;
  final String dataInicio;
  final String dataFim;
  final bool ativa;
}

/// Mesmo shape de `backend/src/coberturas/cobertura-resumo.service.ts`
/// (ClienteResumoHandoffDto).
class ClienteResumoHandoff {
  const ClienteResumoHandoff({
    required this.clienteId,
    required this.clienteNome,
    required this.resumo,
  });

  factory ClienteResumoHandoff.fromJson(Map<String, dynamic> json) {
    return ClienteResumoHandoff(
      clienteId: json['clienteId'] as String,
      clienteNome: json['clienteNome'] as String?,
      // null quando a geração por IA falhou (mesmo critério de
      // OportunidadeClienteDto.contexto).
      resumo: json['resumo'] as String?,
    );
  }

  final String clienteId;
  final String? clienteNome;
  final String? resumo;
}

class CoberturaResumo {
  const CoberturaResumo({required this.coberturaId, required this.clientes});

  factory CoberturaResumo.fromJson(Map<String, dynamic> json) {
    return CoberturaResumo(
      coberturaId: json['coberturaId'] as String,
      clientes: (json['clientes'] as List)
          .cast<Map<String, dynamic>>()
          .map(ClienteResumoHandoff.fromJson)
          .toList(),
    );
  }

  final String coberturaId;
  final List<ClienteResumoHandoff> clientes;
}
