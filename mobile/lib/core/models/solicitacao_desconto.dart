/// Mesmo shape de
/// `backend/src/solicitacoes-desconto/solicitacoes-desconto.service.ts`
/// (SolicitacaoDescontoResumoDto, GET /solicitacoes-desconto, OS-WEB-21) -
/// usado no app pela tela de Aprovações (OS-MOBILE-26).
class SolicitacaoDescontoResumo {
  const SolicitacaoDescontoResumo({
    required this.id,
    required this.percentualSolicitado,
    required this.status,
    required this.criadoEm,
    required this.vendedorSolicitante,
    required this.pedido,
  });

  factory SolicitacaoDescontoResumo.fromJson(Map<String, dynamic> json) {
    return SolicitacaoDescontoResumo(
      id: json['id'] as String,
      percentualSolicitado: (json['percentualSolicitado'] as num).toDouble(),
      status: json['status'] as String,
      criadoEm: json['criadoEm'] as String,
      vendedorSolicitante: VendedorSolicitanteResumo.fromJson(
        json['vendedorSolicitante'] as Map<String, dynamic>,
      ),
      pedido: json['pedido'] == null
          ? null
          : PedidoResumoSolicitacao.fromJson(json['pedido'] as Map<String, dynamic>),
    );
  }

  final String id;
  final double percentualSolicitado;
  final String status;
  final String criadoEm;
  final VendedorSolicitanteResumo vendedorSolicitante;
  final PedidoResumoSolicitacao? pedido;
}

class VendedorSolicitanteResumo {
  const VendedorSolicitanteResumo({required this.id, required this.nome});

  factory VendedorSolicitanteResumo.fromJson(Map<String, dynamic> json) {
    return VendedorSolicitanteResumo(id: json['id'] as String, nome: json['nome'] as String?);
  }

  final String id;
  final String? nome;
}

class PedidoResumoSolicitacao {
  const PedidoResumoSolicitacao({required this.id, required this.valorTotal, required this.cliente});

  factory PedidoResumoSolicitacao.fromJson(Map<String, dynamic> json) {
    return PedidoResumoSolicitacao(
      id: json['id'] as String,
      valorTotal: json['valorTotal'] as String?,
      cliente: json['cliente'] == null
          ? null
          : ClienteResumoSolicitacao.fromJson(json['cliente'] as Map<String, dynamic>),
    );
  }

  final String id;
  final String? valorTotal;
  final ClienteResumoSolicitacao? cliente;
}

class ClienteResumoSolicitacao {
  const ClienteResumoSolicitacao({required this.id, required this.razaoSocial});

  factory ClienteResumoSolicitacao.fromJson(Map<String, dynamic> json) {
    return ClienteResumoSolicitacao(
      id: json['id'] as String,
      razaoSocial: json['razaoSocial'] as String?,
    );
  }

  final String id;
  final String? razaoSocial;
}
