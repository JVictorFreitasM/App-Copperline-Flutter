/// Mesmo shape de `backend/src/pedidos/dto/pedido-response.dto.ts` -
/// duplicado aqui por não haver pacote compartilhado entre mobile e back
/// (mesmo padrão já usado no web, `frontend/src/lib/pedidos.ts`).
class ClienteResumoPedido {
  const ClienteResumoPedido({required this.id, required this.razaoSocial});

  factory ClienteResumoPedido.fromJson(Map<String, dynamic> json) {
    return ClienteResumoPedido(
      id: json['id'] as String,
      razaoSocial: json['razaoSocial'] as String?,
    );
  }

  final String id;
  final String? razaoSocial;
}

class PedidoResumo {
  const PedidoResumo({
    required this.id,
    required this.numero,
    required this.situacao,
    required this.dataHoraUltimaAlteracao,
    required this.valorTotal,
    required this.cliente,
  });

  factory PedidoResumo.fromJson(Map<String, dynamic> json) {
    return PedidoResumo(
      id: json['id'] as String,
      numero: json['numero'] as String?,
      situacao: json['situacao'] as String?,
      dataHoraUltimaAlteracao: json['dataHoraUltimaAlteracao'] as String?,
      valorTotal: json['valorTotal'] as String?,
      cliente: json['cliente'] == null
          ? null
          : ClienteResumoPedido.fromJson(json['cliente'] as Map<String, dynamic>),
    );
  }

  final String id;
  final String? numero;
  final String? situacao;
  final String? dataHoraUltimaAlteracao;
  final String? valorTotal;
  final ClienteResumoPedido? cliente;

  String get tituloCliente => cliente?.razaoSocial ?? 'Cliente não identificado';
}

class ProdutoResumoPedido {
  const ProdutoResumoPedido({required this.id, required this.nome, required this.codigo});

  factory ProdutoResumoPedido.fromJson(Map<String, dynamic> json) {
    return ProdutoResumoPedido(
      id: json['id'] as String,
      nome: json['nome'] as String?,
      codigo: json['codigo'] as String?,
    );
  }

  final String id;
  final String? nome;
  final String? codigo;
}

class PedidoItem {
  const PedidoItem({
    required this.id,
    required this.numero,
    required this.quantidadeVenda,
    required this.valorUnitario,
    required this.valorTotal,
    required this.situacao,
    required this.produto,
  });

  factory PedidoItem.fromJson(Map<String, dynamic> json) {
    return PedidoItem(
      id: json['id'] as String,
      numero: json['numero'] as int,
      quantidadeVenda: json['quantidadeVenda'] as String?,
      valorUnitario: json['valorUnitario'] as String?,
      valorTotal: json['valorTotal'] as String?,
      situacao: json['situacao'] as String?,
      produto: json['produto'] == null
          ? null
          : ProdutoResumoPedido.fromJson(json['produto'] as Map<String, dynamic>),
    );
  }

  final String id;
  final int numero;
  final String? quantidadeVenda;
  final String? valorUnitario;
  final String? valorTotal;
  final String? situacao;
  final ProdutoResumoPedido? produto;
}

class PedidoDetalhe extends PedidoResumo {
  const PedidoDetalhe({
    required super.id,
    required super.numero,
    required super.situacao,
    required super.dataHoraUltimaAlteracao,
    required super.valorTotal,
    required super.cliente,
    required this.itens,
  });

  factory PedidoDetalhe.fromJson(Map<String, dynamic> json) {
    final resumo = PedidoResumo.fromJson(json);
    return PedidoDetalhe(
      id: resumo.id,
      numero: resumo.numero,
      situacao: resumo.situacao,
      dataHoraUltimaAlteracao: resumo.dataHoraUltimaAlteracao,
      valorTotal: resumo.valorTotal,
      cliente: resumo.cliente,
      itens: (json['itens'] as List)
          .cast<Map<String, dynamic>>()
          .map(PedidoItem.fromJson)
          .toList(),
    );
  }

  final List<PedidoItem> itens;
}

class ConfigSituacao {
  const ConfigSituacao({required this.rotulo, required this.enfase});
  final String rotulo;
  final bool enfase;
}

// Mesmo mapa de frontend/src/lib/pedidos.ts (CONFIG_SITUACAO) - só dois
// tons (ver skill design-system): `enfase` destaca só o que já concluiu.
const _configSituacao = {
  'EM_ANALISE': ConfigSituacao(rotulo: 'Em análise', enfase: false),
  'BLOQUEADO': ConfigSituacao(rotulo: 'Bloqueado', enfase: false),
  'PENDENTE': ConfigSituacao(rotulo: 'Pendente', enfase: false),
  'CANCELADO': ConfigSituacao(rotulo: 'Cancelado', enfase: false),
  'PARCIALMENTE_FATURADO': ConfigSituacao(rotulo: 'Parcialmente faturado', enfase: false),
  'FATURADO': ConfigSituacao(rotulo: 'Faturado', enfase: true),
  'PARCIALMENTE_ATENDIDO': ConfigSituacao(rotulo: 'Parcialmente atendido', enfase: false),
  'ATENDIDO': ConfigSituacao(rotulo: 'Atendido', enfase: true),
};

ConfigSituacao configSituacaoPedido(String? situacao) {
  if (situacao == null) return const ConfigSituacao(rotulo: '—', enfase: false);
  return _configSituacao[situacao] ?? ConfigSituacao(rotulo: situacao, enfase: false);
}

final opcoesSituacaoPedido = _configSituacao.entries
    .map((entrada) => (valor: entrada.key, rotulo: entrada.value.rotulo))
    .toList();
