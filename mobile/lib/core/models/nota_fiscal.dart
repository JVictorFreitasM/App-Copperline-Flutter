/// Mesmo shape de `backend/src/notas-fiscais/dto/nota-fiscal-response.dto.ts`
/// (NotaFiscalDto) - duplicado aqui por não haver pacote compartilhado
/// entre mobile e back (mesmo padrão já usado no web, `frontend/src/lib/
/// notas-fiscais.ts`). Nota fiscal não tem cliente próprio no schema - só
/// alcançável via pedidos[].cliente.
class ClienteResumoNotaFiscal {
  const ClienteResumoNotaFiscal({required this.id, required this.razaoSocial});

  factory ClienteResumoNotaFiscal.fromJson(Map<String, dynamic> json) {
    return ClienteResumoNotaFiscal(
      id: json['id'] as String,
      razaoSocial: json['razaoSocial'] as String?,
    );
  }

  final String id;
  final String? razaoSocial;
}

class PedidoResumoNotaFiscal {
  const PedidoResumoNotaFiscal({required this.id, required this.numero, required this.cliente});

  factory PedidoResumoNotaFiscal.fromJson(Map<String, dynamic> json) {
    return PedidoResumoNotaFiscal(
      id: json['id'] as String,
      numero: json['numero'] as String?,
      cliente: json['cliente'] == null
          ? null
          : ClienteResumoNotaFiscal.fromJson(json['cliente'] as Map<String, dynamic>),
    );
  }

  final String id;
  final String? numero;
  final ClienteResumoNotaFiscal? cliente;
}

/// Lista/detalhe standalone (`GET /notas-fiscais`, `GET /notas-fiscais/:id`).
class NotaFiscal {
  const NotaFiscal({
    required this.id,
    required this.chave,
    required this.tipo,
    required this.numero,
    required this.serie,
    required this.dataEmissao,
    required this.statusNfe,
    required this.valorTotalNotaFiscal,
    required this.pedidos,
  });

  factory NotaFiscal.fromJson(Map<String, dynamic> json) {
    return NotaFiscal(
      id: json['id'] as String,
      chave: json['chave'] as String?,
      tipo: json['tipo'] as String?,
      numero: json['numero'] as int?,
      serie: json['serie'] as String?,
      dataEmissao: json['dataEmissao'] as String?,
      statusNfe: json['statusNfe'] as String?,
      valorTotalNotaFiscal: json['valorTotalNotaFiscal'] as String?,
      pedidos: (json['pedidos'] as List? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(PedidoResumoNotaFiscal.fromJson)
          .toList(),
    );
  }

  final String id;
  final String? chave;
  final String? tipo;
  final int? numero;
  final String? serie;
  final String? dataEmissao;
  final String? statusNfe;
  final String? valorTotalNotaFiscal;
  final List<PedidoResumoNotaFiscal> pedidos;

  // Nome do cliente/fornecedor - derivado do primeiro pedido vinculado que
  // tem cliente (nota fiscal não tem cliente próprio, ver comentário acima).
  String get clienteResumo {
    for (final pedido in pedidos) {
      final razaoSocial = pedido.cliente?.razaoSocial;
      if (razaoSocial != null) return razaoSocial;
    }
    return '—';
  }
}

/// Resumo embutido em `GET /pedidos/:id` (`PedidoDetalheDto.notasFiscais`).
class NotaFiscalResumoPedido {
  const NotaFiscalResumoPedido({
    required this.id,
    required this.numero,
    required this.serie,
    required this.chave,
    required this.dataEmissao,
    required this.statusNfe,
    required this.valorTotalNotaFiscal,
  });

  factory NotaFiscalResumoPedido.fromJson(Map<String, dynamic> json) {
    return NotaFiscalResumoPedido(
      id: json['id'] as String,
      numero: json['numero'] as int?,
      serie: json['serie'] as String?,
      chave: json['chave'] as String?,
      dataEmissao: json['dataEmissao'] as String?,
      statusNfe: json['statusNfe'] as String?,
      valorTotalNotaFiscal: json['valorTotalNotaFiscal'] as String?,
    );
  }

  final String id;
  final int? numero;
  final String? serie;
  final String? chave;
  final String? dataEmissao;
  final String? statusNfe;
  final String? valorTotalNotaFiscal;
}

class ConfigStatusNfe {
  const ConfigStatusNfe({required this.rotulo, required this.enfase});
  final String rotulo;
  final bool enfase;
}

// Mesmo mapa de `frontend/src/lib/notas-fiscais.ts` (ROTULOS_STATUS) - só
// AUTORIZADA ganha destaque (ver skill design-system), resto fica neutro.
const _rotulosStatusNfe = {
  'ERRO_VALIDACAO': 'Erro de validação',
  'AGUARDANDO_AUTORIZACAO': 'Aguardando autorização',
  'AUTORIZADA': 'Autorizada',
  'DENEGADA': 'Denegada',
  'REJEITADA': 'Rejeitada',
  'CANCELADA': 'Cancelada',
  'INUTILIZADA': 'Inutilizada',
};

ConfigStatusNfe configStatusNfe(String? status) {
  if (status == null) return const ConfigStatusNfe(rotulo: '—', enfase: false);
  return ConfigStatusNfe(
    rotulo: _rotulosStatusNfe[status] ?? status,
    enfase: status == 'AUTORIZADA',
  );
}

const _rotulosTipoNotaFiscal = {'ENTRADA': 'Entrada', 'SAIDA': 'Saída'};

String rotuloTipoNotaFiscal(String? tipo) {
  if (tipo == null) return '—';
  return _rotulosTipoNotaFiscal[tipo] ?? tipo;
}
