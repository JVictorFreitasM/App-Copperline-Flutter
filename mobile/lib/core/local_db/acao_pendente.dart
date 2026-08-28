/// Mesmo enum de `backend/src/mobile/dto/fila-pendente.dto.ts`
/// (TIPOS_ACAO_FILA, OS-BACKEND-29) - cada valor aqui precisa bater
/// exatamente com a string que o backend espera.
enum TipoAcaoFila { criarPedido, checkinVisita, checkoutVisita, cancelarVisita, rastreioLote }

extension TipoAcaoFilaValor on TipoAcaoFila {
  String get valor => switch (this) {
    TipoAcaoFila.criarPedido => 'CRIAR_PEDIDO',
    TipoAcaoFila.checkinVisita => 'CHECKIN_VISITA',
    TipoAcaoFila.checkoutVisita => 'CHECKOUT_VISITA',
    TipoAcaoFila.cancelarVisita => 'CANCELAR_VISITA',
    TipoAcaoFila.rastreioLote => 'RASTREIO_LOTE',
  };
}

enum StatusAcaoPendente { pendente, enviando, confirmada, erro }

extension StatusAcaoPendenteValor on StatusAcaoPendente {
  String get valor => switch (this) {
    StatusAcaoPendente.pendente => 'PENDENTE',
    StatusAcaoPendente.enviando => 'ENVIANDO',
    StatusAcaoPendente.confirmada => 'CONFIRMADA',
    StatusAcaoPendente.erro => 'ERRO',
  };

  static StatusAcaoPendente deValor(String valor) {
    return StatusAcaoPendente.values.firstWhere((s) => s.valor == valor);
  }
}

/// Uma ação offline enfileirada (OS-MOBILE-22) - espelha uma linha da
/// tabela `acoes_pendentes` (ver local_database.dart).
class AcaoPendente {
  const AcaoPendente({
    required this.idLocal,
    required this.tipo,
    required this.timestamp,
    required this.payload,
    required this.status,
    required this.erro,
  });

  final String idLocal;
  final TipoAcaoFila tipo;
  final String timestamp;
  final Map<String, dynamic> payload;
  final StatusAcaoPendente status;
  final String? erro;
}
