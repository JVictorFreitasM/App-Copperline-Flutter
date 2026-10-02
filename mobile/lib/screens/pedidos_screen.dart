import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/formatacao.dart';
import '../core/models/pedido.dart';
import '../core/providers/pedidos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/pagination_bar.dart';
import 'criar_pedido_screen.dart';
import 'pedido_detalhe_screen.dart';

/// Listagem de pedidos (mobile, equivalente à OS-WEB-13) - consome
/// GET /pedidos (OS-BACKEND-11), mesmo padrão de `ClientesScreen`/
/// `ProdutosScreen`, com o filtro extra de situação (`DropdownButton`
/// preenchido a partir do mesmo mapa de `configSituacaoPedido`).
class PedidosScreen extends ConsumerStatefulWidget {
  const PedidosScreen({super.key});

  @override
  ConsumerState<PedidosScreen> createState() => _PedidosScreenState();
}

class _PedidosScreenState extends ConsumerState<PedidosScreen> {
  int _pagina = 1;
  final _clienteNomeController = TextEditingController();
  String? _clienteNome;
  String? _situacao;
  // Épico 4 (config-aba-orcamento.jpg) - filtro rápido "Só orçamentos".
  bool _soOrcamentos = false;

  @override
  void dispose() {
    _clienteNomeController.dispose();
    super.dispose();
  }

  void _aplicarFiltro() {
    setState(() {
      _pagina = 1;
      _clienteNome = _clienteNomeController.text;
    });
  }

  @override
  Widget build(BuildContext context) {
    final params = (
      pagina: _pagina,
      clienteNome: _clienteNome,
      situacao: _situacao,
      dataInicial: null,
      dataFinal: null,
      statusAprovacao: _soOrcamentos ? 'ORCAMENTO' : null,
    );
    final resultadoAsync = ref.watch(pedidosProvider(params));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pedidos'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton.icon(
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Novo pedido'),
              onPressed: () {
                Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const CriarPedidoScreen()));
              },
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppCard(
              child: Column(
                children: [
                  TextField(
                    controller: _clienteNomeController,
                    decoration: const InputDecoration(labelText: 'Cliente'),
                    onSubmitted: (_) => _aplicarFiltro(),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String?>(
                    initialValue: _situacao,
                    decoration: const InputDecoration(labelText: 'Situação'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Todas')),
                      for (final opcao in opcoesSituacaoPedido)
                        DropdownMenuItem(value: opcao.valor, child: Text(opcao.rotulo)),
                    ],
                    onChanged: (valor) => setState(() {
                      _pagina = 1;
                      _situacao = valor;
                    }),
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Só orçamentos'),
                    value: _soOrcamentos,
                    activeThumbColor: AppColors.primary,
                    onChanged: (valor) => setState(() {
                      _pagina = 1;
                      _soOrcamentos = valor;
                    }),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton(onPressed: _aplicarFiltro, child: const Text('Filtrar')),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            resultadoAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              ),
              error: (erro, _) =>
                  ErroConexao(mensagem: '$erro', aoTentarNovamente: () => setState(() {})),
              data: (resultado) => resultado.data.isEmpty
                  ? const EstadoVazio(mensagem: 'Nenhum pedido encontrado.')
                  : Column(
                      children: [
                        for (final PedidoResumo pedido in resultado.data) ...[
                          Builder(
                            builder: (context) {
                              final situacaoConfig = pedido.situacaoExibida;
                              return ListItemTile(
                                // Pendente de aprovação = fundo levemente
                                // vermelho; aprovado = levemente verde (sobre o
                                // branco do card).
                                fundo: switch (pedido.statusSolicitacaoDesconto) {
                                  'PENDENTE' => Color.alphaBlend(
                                    AppColors.red.withValues(alpha: 0.10),
                                    AppColors.surface,
                                  ),
                                  'APROVADO' => Color.alphaBlend(
                                    AppColors.green.withValues(alpha: 0.10),
                                    AppColors.surface,
                                  ),
                                  _ => null,
                                },
                                titulo: pedido.tituloCliente,
                                subtitulo:
                                    'Pedido ${pedido.numero ?? "—"} · '
                                    '${formatarData(pedido.dataHoraUltimaAlteracao)}',
                                valor: formatarMoeda(pedido.valorTotal),
                                tag: pedido.isOrcamento
                                    ? const AppBadge(texto: 'Orçamento', enfase: true)
                                    : AppBadge(
                                        texto: situacaoConfig.rotulo,
                                        enfase: situacaoConfig.enfase,
                                      ),
                                // Épico 4 (config-aba-orcamento.jpg) -
                                // "Transformar em pedido"/"Cancelar" só
                                // aparecem pra linha que É um orçamento.
                                trailingAction: pedido.isOrcamento
                                    ? _MenuOrcamento(pedido: pedido)
                                    : null,
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => PedidoDetalheScreen(id: pedido.id),
                                  ),
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 8),
                        ],
                        const SizedBox(height: 8),
                        PaginationBar(
                          pagina: resultado.page,
                          totalPaginas: resultado.totalPages,
                          aoMudarPagina: (p) => setState(() => _pagina = p),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// Épico 4 (config-aba-orcamento.jpg) - ações de linha só pra orçamento:
// "Transformar em pedido" (avalia desconto/envia ao ERP igual um pedido
// novo, ver CriarPedidoService.transformarEmPedido no backend) e
// "Cancelar" (apaga - orçamento nunca chegou no ERP). Alteração de
// vendedor (só usuário gerencial) fica fora desta tela por enquanto -
// endpoint já existe (PATCH /pedidos/:id/vendedor), sem UI mobile ainda.
class _MenuOrcamento extends ConsumerWidget {
  const _MenuOrcamento({required this.pedido});

  final PedidoResumo pedido;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      onSelected: (acao) async {
        if (acao == 'transformar') {
          await _transformar(context, ref);
        } else if (acao == 'cancelar') {
          await _cancelar(context, ref);
        }
      },
      itemBuilder: (context) => const [
        PopupMenuItem(value: 'transformar', child: Text('Transformar em pedido')),
        PopupMenuItem(value: 'cancelar', child: Text('Cancelar orçamento')),
      ],
    );
  }

  Future<void> _transformar(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(criarPedidoServiceProvider).transformarEmPedido(pedido.id);
      ref.invalidate(pedidosProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Orçamento transformado em pedido.')));
      }
    } catch (erro) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$erro')));
      }
    }
  }

  Future<void> _cancelar(BuildContext context, WidgetRef ref) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancelar orçamento'),
        content: const Text('Esse orçamento será apagado. Essa ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Voltar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancelar orçamento'),
          ),
        ],
      ),
    );
    if (confirmar != true) return;

    try {
      await ref.read(criarPedidoServiceProvider).cancelarOrcamento(pedido.id);
      ref.invalidate(pedidosProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Orçamento cancelado.')));
      }
    } catch (erro) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$erro')));
      }
    }
  }
}
