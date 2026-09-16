import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/formatacao.dart';
import '../core/models/cliente.dart';
import '../core/models/pedido.dart';
import '../core/models/produto.dart';
import '../core/providers/clientes_provider.dart';
import '../core/providers/pagamento_provider.dart';
import '../core/providers/pedidos_provider.dart';
import '../core/providers/produtos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import 'pedido_detalhe_screen.dart';

const _debounceBusca = Duration(milliseconds: 300);

/// Criação de pedido (OS-BACKEND-25) - equivalente mobile de
/// `frontend/src/app/pedidos/novo/criar-pedido-form.tsx`, mesma lógica:
/// busca de cliente/produto reaproveitando os providers de listagem já
/// existentes, cálculo por item em tempo real (POST /produtos/:id/calcular)
/// e forma/condição de pagamento escolhidas entre os catálogos
/// sincronizados (ver OS-pendentes-claude-code.md - escopo já definido
/// antes desta tela existir: "campo adaptado ao tipo de acondicionamento,
/// chamando POST /produtos/:id/calcular em tempo real").
class CriarPedidoScreen extends ConsumerStatefulWidget {
  const CriarPedidoScreen({super.key});

  @override
  ConsumerState<CriarPedidoScreen> createState() => _CriarPedidoScreenState();
}

class _CriarPedidoScreenState extends ConsumerState<CriarPedidoScreen> {
  final _clienteController = TextEditingController();
  Timer? _debounceCliente;
  List<ClienteResumo> _opcoesCliente = [];
  bool _buscandoCliente = false;
  ClienteResumo? _cliente;

  final _itens = <_ItemPedido>[_ItemPedido()];

  final _descontoController = TextEditingController(text: '0');
  String? _formaPagamentoId;
  String? _condicaoPagamentoId;

  bool _enviando = false;
  String? _erro;

  @override
  void dispose() {
    _clienteController.dispose();
    _debounceCliente?.cancel();
    _descontoController.dispose();
    for (final item in _itens) {
      item.dispose();
    }
    super.dispose();
  }

  void _onMudarClienteQuery(String valor) {
    setState(() => _cliente = null);
    _debounceCliente?.cancel();
    if (valor.trim().isEmpty) {
      setState(() => _opcoesCliente = []);
      return;
    }
    setState(() => _buscandoCliente = true);
    _debounceCliente = Timer(_debounceBusca, () async {
      try {
        final resultado = await ref.read(
          clientesProvider((
            pagina: 1,
            nome: valor,
            cpfCnpj: null,
            filtro: null,
          )).future,
        );
        if (!mounted) return;
        setState(() {
          _opcoesCliente = resultado.data;
          _buscandoCliente = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() => _buscandoCliente = false);
      }
    });
  }

  void _selecionarCliente(ClienteResumo cliente) {
    setState(() {
      _cliente = cliente;
      _clienteController.text = cliente.razaoSocial ?? cliente.nomeFantasia ?? '—';
      _opcoesCliente = [];
    });
  }

  void _onMudarProdutoQuery(_ItemPedido item, String valor) {
    setState(() {
      item.produto = null;
      item.calculo = null;
      item.erroCalculo = null;
    });
    item.debounce?.cancel();
    if (valor.trim().isEmpty) {
      setState(() => item.opcoes = []);
      return;
    }
    setState(() => item.buscando = true);
    item.debounce = Timer(_debounceBusca, () async {
      try {
        final resultado = await ref.read(
          produtosProvider((pagina: 1, nome: valor, codigo: null, gtin: null)).future,
        );
        if (!mounted) return;
        setState(() {
          item.opcoes = resultado.data;
          item.buscando = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() => item.buscando = false);
      }
    });
  }

  void _selecionarProduto(_ItemPedido item, ProdutoResumo produto) {
    setState(() {
      item.produto = produto;
      item.produtoController.text = produto.titulo;
      item.opcoes = [];
    });
  }

  Future<void> _onMudarMetros(_ItemPedido item, String valor) async {
    setState(() {
      item.calculo = null;
      item.erroCalculo = null;
    });
    final produto = item.produto;
    final metros = double.tryParse(valor.replaceAll(',', '.'));
    if (produto == null || metros == null || metros <= 0) return;

    setState(() => item.calculando = true);
    try {
      final resultado = await ref
          .read(criarPedidoServiceProvider)
          .calcular(produtoId: produto.id, metrosDesejados: metros);
      if (!mounted) return;
      setState(() {
        item.calculando = false;
        item.calculo = resultado;
      });
    } on ApiException catch (erro) {
      if (!mounted) return;
      setState(() {
        item.calculando = false;
        item.erroCalculo = erro.message;
      });
    } catch (erro) {
      if (!mounted) return;
      setState(() {
        item.calculando = false;
        item.erroCalculo = '$erro';
      });
    }
  }

  double get _subtotal =>
      _itens.fold(0, (soma, item) => soma + (item.calculo?.valorFinal ?? 0));

  double get _desconto => double.tryParse(_descontoController.text.replaceAll(',', '.')) ?? 0;

  double get _totalComDesconto => _subtotal * (1 - _desconto / 100);

  bool get _podeSubmeter {
    if (_cliente == null || _formaPagamentoId == null || _condicaoPagamentoId == null) {
      return false;
    }
    return _itens.every((item) => item.produto != null && item.calculo != null && item.erroCalculo == null);
  }

  Future<void> _onSubmeter() async {
    setState(() => _erro = null);
    if (_cliente == null) {
      setState(() => _erro = 'Selecione um cliente.');
      return;
    }
    if (_formaPagamentoId == null) {
      setState(() => _erro = 'Selecione a forma de pagamento.');
      return;
    }
    if (_condicaoPagamentoId == null) {
      setState(() => _erro = 'Selecione a condição de pagamento.');
      return;
    }
    final itensValidos = _itens.where((item) => item.produto != null).toList();
    if (itensValidos.isEmpty) {
      setState(() => _erro = 'Adicione pelo menos um item.');
      return;
    }
    if (itensValidos.any((item) => item.calculo == null)) {
      setState(() => _erro = 'Aguarde o cálculo de todos os itens (ou corrija os que deram erro).');
      return;
    }

    setState(() => _enviando = true);
    try {
      final pedidoId = await ref.read(criarPedidoServiceProvider).criar(
        clienteId: _cliente!.id,
        percentualDesconto: _desconto,
        formaPagamentoId: _formaPagamentoId!,
        condicaoPagamentoId: _condicaoPagamentoId!,
        itens: itensValidos
            .map(
              (item) => {
                'produtoId': item.produto!.id,
                'metrosDesejados': double.parse(item.metrosController.text.replaceAll(',', '.')),
              },
            )
            .toList(),
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => PedidoDetalheScreen(id: pedidoId)),
      );
    } on ApiException catch (erro) {
      if (!mounted) return;
      setState(() {
        _enviando = false;
        _erro = erro.message;
      });
    } catch (erro) {
      if (!mounted) return;
      setState(() {
        _enviando = false;
        _erro = '$erro';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final formasAsync = ref.watch(formasPagamentoProvider);
    final condicoesAsync = ref.watch(condicoesPagamentoProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Novo pedido')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _clienteController,
                    decoration: const InputDecoration(labelText: 'Cliente'),
                    onChanged: _onMudarClienteQuery,
                  ),
                  if (_cliente == null) ...[
                    if (_buscandoCliente)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text('Buscando...', style: TextStyle(color: AppColors.muted)),
                      )
                    else
                      for (final opcao in _opcoesCliente)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(opcao.razaoSocial ?? opcao.nomeFantasia ?? '—'),
                          onTap: () => _selecionarCliente(opcao),
                        ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text('Itens', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final item in _itens) ...[
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: item.produtoController,
                            decoration: const InputDecoration(labelText: 'Produto'),
                            onChanged: (valor) => _onMudarProdutoQuery(item, valor),
                          ),
                        ),
                        if (_itens.length > 1)
                          IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () => setState(() {
                              item.dispose();
                              _itens.remove(item);
                            }),
                          ),
                      ],
                    ),
                    if (item.produto == null)
                      if (item.buscando)
                        const Padding(
                          padding: EdgeInsets.only(top: 4),
                          child: Text('Buscando...', style: TextStyle(color: AppColors.muted)),
                        )
                      else
                        for (final opcao in item.opcoes)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(opcao.titulo),
                            onTap: () => _selecionarProduto(item, opcao),
                          ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: item.metrosController,
                      enabled: item.produto != null,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Metros desejados'),
                      onChanged: (valor) => _onMudarMetros(item, valor),
                    ),
                    if (item.calculando)
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: Text('Calculando...', style: TextStyle(color: AppColors.muted)),
                      ),
                    if (item.erroCalculo != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(item.erroCalculo!, style: const TextStyle(color: AppColors.red)),
                      ),
                    if (item.calculo != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          '${item.calculo!.quantidade} ${item.calculo!.unidade} · '
                          '${formatarMoeda('${item.calculo!.valorFinal}')}',
                          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            OutlinedButton.icon(
              onPressed: () => setState(() => _itens.add(_ItemPedido())),
              icon: const Icon(Icons.add),
              label: const Text('Adicionar item'),
            ),
            const SizedBox(height: 16),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  formasAsync.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (erro, _) => Text('$erro', style: const TextStyle(color: AppColors.red)),
                    data: (formas) => DropdownButtonFormField<String>(
                      initialValue: _formaPagamentoId,
                      decoration: const InputDecoration(labelText: 'Forma de pagamento'),
                      items: [
                        for (final forma in formas)
                          DropdownMenuItem(value: forma.id, child: Text(forma.titulo)),
                      ],
                      onChanged: (valor) => setState(() => _formaPagamentoId = valor),
                    ),
                  ),
                  const SizedBox(height: 8),
                  condicoesAsync.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (erro, _) => Text('$erro', style: const TextStyle(color: AppColors.red)),
                    data: (condicoes) => DropdownButtonFormField<String>(
                      initialValue: _condicaoPagamentoId,
                      decoration: const InputDecoration(labelText: 'Condição de pagamento'),
                      items: [
                        for (final condicao in condicoes)
                          DropdownMenuItem(value: condicao.id, child: Text(condicao.titulo)),
                      ],
                      onChanged: (valor) => setState(() => _condicaoPagamentoId = valor),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _descontoController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Desconto (%)'),
                    onChanged: (_) => setState(() {}),
                  ),
                  const Divider(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total estimado', style: TextStyle(color: AppColors.muted)),
                      Text(
                        formatarMoeda('$_totalComDesconto'),
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (_erro != null) ...[
              const SizedBox(height: 12),
              Text(_erro!, style: const TextStyle(color: AppColors.red)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: (_enviando || !_podeSubmeter) ? null : _onSubmeter,
              child: Text(_enviando ? 'Enviando...' : 'Confirmar pedido'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ItemPedido {
  final produtoController = TextEditingController();
  final metrosController = TextEditingController();
  List<ProdutoResumo> opcoes = [];
  ProdutoResumo? produto;
  bool buscando = false;
  bool calculando = false;
  ResultadoCalculoQuantidade? calculo;
  String? erroCalculo;
  Timer? debounce;

  void dispose() {
    produtoController.dispose();
    metrosController.dispose();
    debounce?.cancel();
  }
}
