import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/formatacao.dart';
import '../core/local_db/acao_pendente.dart';
import '../core/localizacao_atual.dart';
import '../core/models/cliente.dart';
import '../core/models/pedido.dart';
import '../core/models/produto.dart';
import '../core/providers/aprovacoes_provider.dart';
import '../core/providers/clientes_provider.dart';
import '../core/providers/offline_provider.dart';
import '../core/providers/pagamento_provider.dart';
import '../core/providers/pedidos_provider.dart';
import '../core/providers/produtos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import 'pedido_detalhe_screen.dart';

const _debounceBusca = Duration(milliseconds: 300);
const _metrosPorKm = 1000;

// unidade "METRO" vem do backend em METROS (corte fracionário livre, ver
// calculo-quantidade-pedido.ts) - convertida aqui pra KM só pra exibição
// (pedido do usuário, 2026-09-17: "100m = 0.1km"). "PECA" (rolo/peça
// fechada) não é distância, fica como está.
String _formatarQuantidadeCalculo(ResultadoCalculoQuantidade calculo) {
  if (calculo.unidade == 'METRO') {
    final km = calculo.quantidade / _metrosPorKm;
    return '${km.toStringAsFixed(3)} KM';
  }
  return '${calculo.quantidade} ${calculo.unidade}';
}

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

  final _observacoesController = TextEditingController();
  String? _formaPagamentoId;
  String? _condicaoPagamentoId;

  // Paridade com o fluxo web (pedido do usuário, 2026-09-30) -
  // criar-pedido-form.tsx tem tabela de preços/contato/vendedor além do
  // que o mobile já tinha.
  String? _codigoTabelaPreco;
  String? _contatoId;
  String? _vendedorId;

  bool _enviando = false;
  String? _erro;

  @override
  void dispose() {
    _clienteController.dispose();
    _debounceCliente?.cancel();
    _observacoesController.dispose();
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
      // Tabela/contato dependem de qual cliente está selecionado - trocar
      // de cliente reseta os dois, mesmo critério do web
      // (criar-pedido-form.tsx `selecionarCliente`).
      _codigoTabelaPreco = null;
      _contatoId = null;
    });
    _resolverTabelaPreco(cliente.id);
  }

  // GET /clientes/:id/tabelas-preco (web: tabela-preco-popup.tsx) - só 1
  // tabela associada auto-seleciona sem perguntar nada; 0 segue no
  // fallback global de sempre; 2+ pede pro vendedor escolher.
  Future<void> _resolverTabelaPreco(String clienteId) async {
    try {
      final codigos = await ref.read(tabelasPrecoClienteProvider(clienteId).future);
      if (!mounted) return;
      if (codigos.length == 1) {
        setState(() => _codigoTabelaPreco = codigos.first);
        return;
      }
      if (codigos.length > 1) {
        final escolhido = await showDialog<String>(
          context: context,
          builder: (dialogContext) => SimpleDialog(
            title: const Text('Escolha a tabela de preços'),
            children: [
              for (final codigo in codigos)
                SimpleDialogOption(
                  onPressed: () => Navigator.of(dialogContext).pop(codigo),
                  child: Text(codigo),
                ),
            ],
          ),
        );
        if (!mounted || escolhido == null) return;
        setState(() => _codigoTabelaPreco = escolhido);
      }
    } catch (_) {
      // Sem tabela específica pro cliente - segue no fallback global de
      // sempre (mesmo critério do web).
    }
  }

  Future<void> _adicionarContato() async {
    final cliente = _cliente;
    if (cliente == null) return;
    final dados = await showDialog<_DadosNovoContato>(
      context: context,
      builder: (_) => const _DialogNovoContato(),
    );
    if (dados == null) return;
    try {
      final contato = await ref
          .read(criarPedidoServiceProvider)
          .criarContato(
            clienteId: cliente.id,
            nome: dados.nome,
            telefoneDdd: dados.telefoneDdd,
            telefoneNumero: dados.telefoneNumero,
            email: dados.email,
            funcao: dados.funcao,
          );
      if (!mounted) return;
      // Invalida o detalhe do cliente pra recarregar com o contato novo
      // já na lista (mesmo critério de qualquer outra mutação seguida de
      // refetch nesse app).
      ref.invalidate(clienteDetalheProvider(cliente.id));
      setState(() => _contatoId = contato.id);
    } catch (erro) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Falha ao adicionar contato: $erro')));
    }
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
        // Busca por nome E por código em paralelo (o backend combina os
        // dois filtros com AND, não dá pra mandar juntos pro mesmo termo)
        // - mescla os resultados sem duplicar produto que bater nos dois.
        final resultados = await Future.wait([
          ref.read(produtosProvider((pagina: 1, nome: valor, codigo: null, gtin: null)).future),
          ref.read(produtosProvider((pagina: 1, nome: null, codigo: valor, gtin: null)).future),
        ]);
        if (!mounted) return;
        final vistos = <String>{};
        final opcoes = <ProdutoResumo>[];
        for (final produto in [...resultados[0].data, ...resultados[1].data]) {
          if (!vistos.add(produto.id)) continue;
          opcoes.add(produto);
        }
        setState(() {
          item.opcoes = opcoes;
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

  // Desconto é POR ITEM (ver comentário em CriarPedidoService.calcular) -
  // recalcula sempre que quilômetros OU desconto do item mudam, mesmo
  // critério de item-detalhe-popup.tsx `recalcular(km, desconto)` no web.
  Future<void> _recalcularItem(_ItemPedido item) async {
    setState(() {
      item.calculo = null;
      item.erroCalculo = null;
    });
    final produto = item.produto;
    final km = double.tryParse(item.metrosController.text.replaceAll(',', '.'));
    final desconto = double.tryParse(item.descontoController.text.replaceAll(',', '.')) ?? 0;
    if (produto == null || km == null || km <= 0) return;

    setState(() => item.calculando = true);
    try {
      final resultado = await ref
          .read(criarPedidoServiceProvider)
          .calcular(
            produtoId: produto.id,
            metrosDesejados: km * _metrosPorKm,
            percentualDesconto: desconto,
            codigoTabela: _codigoTabelaPreco,
          );
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

  void _onMudarMetros(_ItemPedido item, String valor) {
    _recalcularItem(item);
  }

  // Aviso PROATIVO de que o desconto digitado vai exigir aprovação, antes
  // de confirmar o pedido (POST /pedidos/simular-desconto, sem efeito
  // colateral nenhum). Debounce só nessa parte (evita 1 chamada por
  // dígito) - o recálculo de preço em si segue imediato, mesmo critério
  // de _onMudarMetros.
  void _onMudarDescontoItem(_ItemPedido item, String valor) {
    setState(() => item.simulacaoDesconto = null);
    _recalcularItem(item);

    item.debounceDesconto?.cancel();
    final percentual = double.tryParse(valor.replaceAll(',', '.'));
    if (percentual == null || percentual <= 0) return;
    item.debounceDesconto = Timer(_debounceBusca, () async {
      try {
        final resultado = await ref
            .read(criarPedidoServiceProvider)
            .simularDesconto(percentual);
        if (!mounted) return;
        setState(() => item.simulacaoDesconto = resultado);
      } catch (_) {
        // Aviso é só um extra informativo - se a simulação falhar (rede,
        // etc), o envio de verdade continua o juiz final (backend rejeita/
        // exige aprovação do mesmo jeito, com ou sem esse aviso prévio).
      }
    });
  }

  // Já vem líquido do backend (cada item calcula com seu próprio
  // percentualDesconto, ver _recalcularItem) - sem desconto adicional a
  // aplicar aqui em cima.
  double get _subtotal =>
      _itens.fold(0, (soma, item) => soma + (item.calculo?.valorFinal ?? 0));

  // Mesmo shape de CriarPedidoItemDto (backend) - reaproveitado tanto no
  // envio direto quanto no payload enfileirado offline (ver
  // _enfileirarOffline), pra nunca divergir entre os dois caminhos.
  Map<String, dynamic> _itemParaPayload(_ItemPedido item) => {
    'produtoId': item.produto!.id,
    'metrosDesejados': double.parse(item.metrosController.text.replaceAll(',', '.')) * _metrosPorKm,
    'percentualDesconto': double.tryParse(item.descontoController.text.replaceAll(',', '.')) ?? 0,
    if (item.observacoesController.text.trim().isNotEmpty)
      'observacoes': item.observacoesController.text.trim(),
  };

  bool get _podeSubmeter {
    if (_cliente == null || _formaPagamentoId == null || _condicaoPagamentoId == null) {
      return false;
    }
    if (_itens.isEmpty) return false;
    return _itens.every((item) => item.produto != null && item.calculo != null && item.erroCalculo == null);
  }

  Future<void> _onSubmeter({bool salvarComoOrcamento = false}) async {
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

    // Etapa de revisão (pedido do usuário, 2026-09-30) - web submete
    // direto, sem confirmação intermediária; mobile ganha essa etapa a
    // mais porque é fácil tocar sem querer em campo (mesmo padrão de
    // confirmação já usado em cliente_detalhe_screen.dart pra "definir
    // localização").
    final confirmado = await _confirmarEnvio(
      itensValidos: itensValidos,
      salvarComoOrcamento: salvarComoOrcamento,
    );
    if (confirmado != true) return;

    setState(() => _enviando = true);
    try {
      // Posição best-effort (Épico 4, config-aba-rastreio.jpg -
      // "Distância máxima do cliente para registro de pedido") - tenta
      // capturar, mas NUNCA bloqueia o envio se falhar (permissão
      // negada, GPS indisponível): o backend só exige de verdade quando
      // essa distância tiver um valor configurado, e nesse caso já
      // rejeita com uma mensagem clara (mostrada via ApiException
      // abaixo) se a posição realmente faltar.
      double? latitude;
      double? longitude;
      try {
        final posicao = await obterPosicaoAtual();
        latitude = posicao.latitude;
        longitude = posicao.longitude;
      } catch (_) {
        // Segue sem posição - ver comentário acima.
      }

      final itensPayload = itensValidos.map(_itemParaPayload).toList();
      final observacoes = _observacoesController.text.trim().isEmpty
          ? null
          : _observacoesController.text.trim();

      final resultado = await ref.read(criarPedidoServiceProvider).criar(
        clienteId: _cliente!.id,
        formaPagamentoId: _formaPagamentoId!,
        condicaoPagamentoId: _condicaoPagamentoId!,
        itens: itensPayload,
        latitude: latitude,
        longitude: longitude,
        salvarComoOrcamento: salvarComoOrcamento,
        observacoes: observacoes,
        codigoTabelaPreco: _codigoTabelaPreco,
        contatoId: _contatoId,
        vendedorId: _vendedorId,
      );
      if (!mounted) return;
      if (resultado.status == 'ORCAMENTO') {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Orçamento salvo.')));
      } else if (resultado.status == 'AGUARDANDO_APROVACAO') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Pedido enviado para aprovação do desconto.')),
        );
      }
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => PedidoDetalheScreen(id: resultado.pedidoId)),
      );
    } on ApiException catch (erro) {
      if (!mounted) return;
      // Pedido do usuário (2026-09-30) - falha de REDE (sem resposta
      // nenhuma do servidor, statusCode null - mesmo critério de
      // cliente_detalhe_screen.dart, TipoAcaoFila.checkinVisita) enfileira
      // localmente pra reenvio automático quando a conexão voltar (OS-
      // MOBILE-22), em vez de simplesmente perder o pedido. Erro de
      // NEGÓCIO (4xx com resposta, ex: desconto acima do limite sem
      // hierarquia configurada) continua rejeitado na hora, sem fila -
      // reenviar do mesmo jeito só repetiria a mesma rejeição.
      if (erro.statusCode == null) {
        await _enfileirarOffline(
          clienteId: _cliente!.id,
          formaPagamentoId: _formaPagamentoId!,
          condicaoPagamentoId: _condicaoPagamentoId!,
          itensValidos: itensValidos,
          salvarComoOrcamento: salvarComoOrcamento,
        );
        return;
      }
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

  Future<void> _enfileirarOffline({
    required String clienteId,
    required String formaPagamentoId,
    required String condicaoPagamentoId,
    required List<_ItemPedido> itensValidos,
    required bool salvarComoOrcamento,
  }) async {
    try {
      final fila = await ref.read(filaPendenteServiceProvider.future);
      await fila.enfileirar(
        tipo: TipoAcaoFila.criarPedido,
        timestamp: DateTime.now(),
        // Mesmo shape de CriarPedidoDto (backend, ver
        // CriarPedidoOfflineDto) - o payload aqui é reenviado ao pé da
        // letra na próxima sincronização (FilaPendenteService.executar,
        // case 'CRIAR_PEDIDO').
        payload: {
          'clienteId': clienteId,
          'formaPagamentoId': formaPagamentoId,
          'condicaoPagamentoId': condicaoPagamentoId,
          'itens': itensValidos.map(_itemParaPayload).toList(),
          if (salvarComoOrcamento) 'salvarComoOrcamento': salvarComoOrcamento,
          if (_observacoesController.text.trim().isNotEmpty)
            'observacoes': _observacoesController.text.trim(),
          if (_codigoTabelaPreco != null) 'codigoTabelaPreco': _codigoTabelaPreco,
          if (_contatoId != null) 'contatoId': _contatoId,
          if (_vendedorId != null) 'vendedorId': _vendedorId,
        },
      );
      if (!mounted) return;
      ref.invalidate(contagemPendentesProvider);
      ref.invalidate(acoesPendentesPorTipoProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Sem conexão agora - pedido salvo e será enviado automaticamente '
            'quando a internet voltar.',
          ),
        ),
      );
      Navigator.of(context).pop();
    } catch (erro) {
      if (!mounted) return;
      setState(() {
        _enviando = false;
        _erro = 'Falha ao salvar pedido offline: $erro';
      });
    }
  }

  Future<bool?> _confirmarEnvio({
    required List<_ItemPedido> itensValidos,
    required bool salvarComoOrcamento,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(salvarComoOrcamento ? 'Salvar orçamento?' : 'Confirmar pedido?'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_cliente!.titulo, style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              for (final item in itensValidos)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    '${item.produto!.titulo} - '
                    '${_formatarQuantidadeCalculo(item.calculo!)} - '
                    '${formatarMoeda('${item.calculo!.valorFinal}')}',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              const Divider(),
              Text(
                'Total: ${formatarMoeda('$_subtotal')}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Revisar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
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
                  if (_cliente != null) ...[
                    const SizedBox(height: 8),
                    Consumer(
                      builder: (context, ref, _) {
                        final clienteAsync = ref.watch(clienteDetalheProvider(_cliente!.id));
                        return clienteAsync.when(
                          loading: () => const LinearProgressIndicator(),
                          error: (_, _) => const SizedBox.shrink(),
                          data: (clienteDetalhe) => DropdownButtonFormField<String>(
                            initialValue: _contatoId,
                            decoration: const InputDecoration(labelText: 'Contato'),
                            items: [
                              for (final contato in clienteDetalhe.contatos)
                                DropdownMenuItem(
                                  value: contato.id,
                                  child: Text(contato.nome ?? '—'),
                                ),
                              const DropdownMenuItem(
                                value: '__novo__',
                                child: Text('+ Adicionar contato...'),
                              ),
                            ],
                            onChanged: (valor) {
                              if (valor == '__novo__') {
                                _adicionarContato();
                                return;
                              }
                              setState(() => _contatoId = valor);
                            },
                          ),
                        );
                      },
                    ),
                    if (_codigoTabelaPreco != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Tabela de preços: $_codigoTabelaPreco',
                        style: const TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ],
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
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          tooltip: 'Remover item',
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
                      decoration: const InputDecoration(labelText: 'Quilômetros desejados'),
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
                          '${_formatarQuantidadeCalculo(item.calculo!)} · '
                          '${formatarMoeda('${item.calculo!.valorFinal}')}',
                          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
                        ),
                      ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: item.descontoController,
                      enabled: item.produto != null,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Desconto no item (%)'),
                      onChanged: (valor) => _onMudarDescontoItem(item, valor),
                    ),
                    if (item.simulacaoDesconto?.necessitaAprovacao == true)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          item.simulacaoDesconto!.aprovadorEsperadoNome != null
                              ? 'Esse desconto vai precisar de aprovação de '
                                  '${item.simulacaoDesconto!.aprovadorEsperadoNome}.'
                              : 'Esse desconto vai precisar de aprovação antes de ser enviado ao ERP.',
                          style: const TextStyle(fontSize: 12, color: AppColors.amber),
                        ),
                      ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: item.observacoesController,
                      maxLength: 500,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Observação do item',
                        hintText: 'Opcional',
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
                  // Só aparece pra supervisor/gerente (403 pro resto vira
                  // lista vazia, ver vendedoresEquipeProvider) - "em nome
                  // de qual vendedor da equipe" criar o pedido.
                  Consumer(
                    builder: (context, ref, _) {
                      final equipeAsync = ref.watch(vendedoresEquipeProvider);
                      final meuVendedorAsync = ref.watch(meuVendedorProvider);
                      return equipeAsync.when(
                        loading: () => const SizedBox.shrink(),
                        error: (_, _) => const SizedBox.shrink(),
                        data: (equipe) {
                          if (equipe.isEmpty) return const SizedBox.shrink();
                          final meuId = meuVendedorAsync.asData?.value.vendedorId;
                          // Própria conta primeiro, resto da equipe depois
                          // - mesmo critério do web.
                          final ordenada = [
                            ...equipe.where((v) => v.id == meuId),
                            ...equipe.where((v) => v.id != meuId),
                          ];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: DropdownButtonFormField<String>(
                              initialValue: _vendedorId ?? meuId,
                              decoration: const InputDecoration(labelText: 'Vendedor'),
                              items: [
                                for (final vendedor in ordenada)
                                  DropdownMenuItem(
                                    value: vendedor.id,
                                    child: Text(vendedor.nome ?? '—'),
                                  ),
                              ],
                              onChanged: (valor) => setState(() => _vendedorId = valor),
                            ),
                          );
                        },
                      );
                    },
                  ),
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
                    controller: _observacoesController,
                    maxLength: 2000,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Observações',
                      hintText: 'Opcional',
                    ),
                  ),
                  const Divider(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total estimado', style: TextStyle(color: AppColors.muted)),
                      Text(
                        formatarMoeda('$_subtotal'),
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
            Row(
              children: [
                // Épico 4 (config-aba-orcamento.jpg) - "Salvar como
                // Orçamento" ao lado de "Confirmar pedido". Sem checar
                // habilitarCriacaoOrcamento aqui (não exposto no
                // snapshot) - se o admin desabilitou, o backend rejeita
                // com mensagem clara, mostrada como qualquer outro erro.
                Expanded(
                  child: OutlinedButton(
                    onPressed: (_enviando || !_podeSubmeter)
                        ? null
                        : () => _onSubmeter(salvarComoOrcamento: true),
                    child: const Text('Salvar como orçamento'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: (_enviando || !_podeSubmeter) ? null : () => _onSubmeter(),
                    child: Text(_enviando ? 'Enviando...' : 'Confirmar pedido'),
                  ),
                ),
              ],
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
  // Desconto POR ITEM (CriarPedidoItemDto.percentualDesconto, obrigatório
  // desde d3abf2d) - não existe mais um percentual único do pedido
  // inteiro (ver comentário em CriarPedidoService.calcular/criar).
  final descontoController = TextEditingController(text: '0');
  // Pedido do usuario (2026-09-30) - PedidoItem.observacoes ja existia no
  // backend (CriarPedidoItemDto, max 500) e no web, so faltava no mobile.
  final observacoesController = TextEditingController();
  List<ProdutoResumo> opcoes = [];
  ProdutoResumo? produto;
  bool buscando = false;
  bool calculando = false;
  ResultadoCalculoQuantidade? calculo;
  String? erroCalculo;
  SimulacaoDesconto? simulacaoDesconto;
  Timer? debounce;
  Timer? debounceDesconto;

  void dispose() {
    produtoController.dispose();
    metrosController.dispose();
    descontoController.dispose();
    observacoesController.dispose();
    debounce?.cancel();
    debounceDesconto?.cancel();
  }
}

typedef _DadosNovoContato = ({
  String nome,
  String telefoneDdd,
  String telefoneNumero,
  String email,
  String funcao,
});

/// Equivalente mobile de `frontend/src/app/pedidos/novo/
/// adicionar-contato-popup.tsx` - só `nome` é obrigatório (mesmo critério
/// do backend, CriarContatoClienteDto).
class _DialogNovoContato extends StatefulWidget {
  const _DialogNovoContato();

  @override
  State<_DialogNovoContato> createState() => _DialogNovoContatoState();
}

class _DialogNovoContatoState extends State<_DialogNovoContato> {
  final _nomeController = TextEditingController();
  final _dddController = TextEditingController();
  final _telefoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _funcaoController = TextEditingController();
  String? _erro;

  @override
  void dispose() {
    _nomeController.dispose();
    _dddController.dispose();
    _telefoneController.dispose();
    _emailController.dispose();
    _funcaoController.dispose();
    super.dispose();
  }

  void _confirmar() {
    if (_nomeController.text.trim().isEmpty) {
      setState(() => _erro = 'Nome é obrigatório.');
      return;
    }
    Navigator.of(context).pop((
      nome: _nomeController.text.trim(),
      telefoneDdd: _dddController.text.trim(),
      telefoneNumero: _telefoneController.text.trim(),
      email: _emailController.text.trim(),
      funcao: _funcaoController.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Adicionar contato'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _nomeController,
              decoration: const InputDecoration(labelText: 'Nome'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _dddController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'DDD'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _telefoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Telefone'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'E-mail'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _funcaoController,
              decoration: const InputDecoration(labelText: 'Função'),
            ),
            if (_erro != null) ...[
              const SizedBox(height: 8),
              Text(_erro!, style: const TextStyle(color: AppColors.red, fontSize: 12)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(onPressed: _confirmar, child: const Text('Adicionar')),
      ],
    );
  }
}
