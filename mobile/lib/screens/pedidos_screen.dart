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
    );
    final resultadoAsync = ref.watch(pedidosProvider(params));

    return Scaffold(
      appBar: AppBar(title: const Text('Pedidos')),
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
                              final situacaoConfig = configSituacaoPedido(pedido.situacao);
                              return ListItemTile(
                                titulo: pedido.tituloCliente,
                                subtitulo:
                                    'Pedido ${pedido.numero ?? "—"} · '
                                    '${formatarData(pedido.dataHoraUltimaAlteracao)}',
                                valor: formatarMoeda(pedido.valorTotal),
                                tag: AppBadge(
                                  texto: situacaoConfig.rotulo,
                                  enfase: situacaoConfig.enfase,
                                ),
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
