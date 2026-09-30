import 'nota_fiscal.dart';

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
    required this.statusAprovacaoBucket,
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
      // Épico 4 (config-aba-orcamento.jpg) - "ORCAMENTO" é um dos valores
      // possíveis desde então (ver backend, pedido-response.dto.ts).
      // Ausente (snapshot de app antigo, offline) = null, tratado como
      // pedido normal (nenhuma ação de orçamento aparece).
      statusAprovacaoBucket: json['statusAprovacaoBucket'] as String?,
    );
  }

  final String id;
  final String? numero;
  final String? situacao;
  final String? dataHoraUltimaAlteracao;
  final String? valorTotal;
  final ClienteResumoPedido? cliente;
  final String? statusAprovacaoBucket;

  bool get isOrcamento => statusAprovacaoBucket == 'ORCAMENTO';

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
    required this.observacoes,
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
      observacoes: json['observacoes'] as String?,
    );
  }

  final String id;
  final int numero;
  final String? quantidadeVenda;
  final String? valorUnitario;
  final String? valorTotal;
  final String? situacao;
  final ProdutoResumoPedido? produto;
  final String? observacoes;
}

class PedidoDetalhe extends PedidoResumo {
  const PedidoDetalhe({
    required super.id,
    required super.numero,
    required super.situacao,
    required super.dataHoraUltimaAlteracao,
    required super.valorTotal,
    required super.cliente,
    required super.statusAprovacaoBucket,
    required this.itens,
    required this.pesoLiquidoTotalKg,
    required this.pesoBrutoTotalKg,
    required this.notasFiscais,
    required this.observacoes,
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
      statusAprovacaoBucket: resumo.statusAprovacaoBucket,
      itens: (json['itens'] as List)
          .cast<Map<String, dynamic>>()
          .map(PedidoItem.fromJson)
          .toList(),
      pesoLiquidoTotalKg: json['pesoLiquidoTotalKg'] as String?,
      pesoBrutoTotalKg: json['pesoBrutoTotalKg'] as String?,
      // Pedido do usuario (2026-09-30) - ausente em snapshot local antigo
      // (offline) vira lista vazia, tratado igual "nenhuma nota vinculada
      // ainda" (mesmo criterio de `itens`/pesos acima).
      notasFiscais: (json['notasFiscais'] as List? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(NotaFiscalResumoPedido.fromJson)
          .toList(),
      observacoes: json['observacoes'] as String?,
    );
  }

  final List<PedidoItem> itens;
  // OS-novas-implementacoes.md Bloco 3 - null quando algum item do pedido
  // não tem peso cadastrado (mesmo critério "tudo ou nada" do backend,
  // CriarPedidoService.calcularPesoTotal).
  final String? pesoLiquidoTotalKg;
  final String? pesoBrutoTotalKg;
  final List<NotaFiscalResumoPedido> notasFiscais;
  final String? observacoes;

  // Mesmo criterio do web (esperaNotaFiscal, pedidos/[id]/page.tsx) -
  // FATURADO/PARCIALMENTE_FATURADO deve mostrar a secao mesmo sem nenhuma
  // nota vinculada ainda, pra deixar claro que algo esta pendente.
  bool get esperaNotaFiscal => situacao == 'FATURADO' || situacao == 'PARCIALMENTE_FATURADO';
}

/// Mesmo shape de `backend/src/produtos/produto-calculo.service.ts`
/// (ResultadoCalculoComPreco) - resposta de `POST /produtos/:id/calcular`,
/// usada na criação de pedido (OS-MOBILE, criar_pedido_screen.dart) pra
/// mostrar quantidade/valor calculados ANTES de enviar o pedido inteiro.
class ResultadoCalculoQuantidade {
  const ResultadoCalculoQuantidade({
    required this.quantidade,
    required this.unidade,
    required this.valorFinal,
  });

  factory ResultadoCalculoQuantidade.fromJson(Map<String, dynamic> json) {
    return ResultadoCalculoQuantidade(
      quantidade: (json['quantidade'] as num).toDouble(),
      unidade: json['unidade'] as String,
      valorFinal: (json['valorFinal'] as num).toDouble(),
    );
  }

  final double quantidade;
  final String unidade;
  final double valorFinal;
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
