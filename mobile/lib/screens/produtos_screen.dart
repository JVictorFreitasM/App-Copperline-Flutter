import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/formatacao.dart';
import '../core/models/produto.dart';
import '../core/providers/produtos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/pagination_bar.dart';
import 'produto_detalhe_screen.dart';

/// Listagem de produtos (mobile, equivalente à OS-WEB-12) - consome
/// GET /produtos (OS-BACKEND-11), mesmo padrão de `ClientesScreen`.
class ProdutosScreen extends ConsumerStatefulWidget {
  const ProdutosScreen({super.key});

  @override
  ConsumerState<ProdutosScreen> createState() => _ProdutosScreenState();
}

class _ProdutosScreenState extends ConsumerState<ProdutosScreen> {
  int _pagina = 1;
  final _nomeController = TextEditingController();
  final _codigoController = TextEditingController();
  final _gtinController = TextEditingController();
  String? _nome;
  String? _codigo;
  String? _gtin;

  @override
  void dispose() {
    _nomeController.dispose();
    _codigoController.dispose();
    _gtinController.dispose();
    super.dispose();
  }

  void _aplicarFiltro() {
    setState(() {
      _pagina = 1;
      _nome = _nomeController.text;
      _codigo = _codigoController.text;
      _gtin = _gtinController.text;
    });
  }

  @override
  Widget build(BuildContext context) {
    final params = (pagina: _pagina, nome: _nome, codigo: _codigo, gtin: _gtin);
    final resultadoAsync = ref.watch(produtosProvider(params));

    return Scaffold(
      appBar: AppBar(title: const Text('Produtos')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppCard(
              child: Column(
                children: [
                  TextField(
                    controller: _nomeController,
                    decoration: const InputDecoration(labelText: 'Nome'),
                    onSubmitted: (_) => _aplicarFiltro(),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _codigoController,
                    decoration: const InputDecoration(labelText: 'Código'),
                    onSubmitted: (_) => _aplicarFiltro(),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _gtinController,
                    decoration: const InputDecoration(labelText: 'GTIN'),
                    onSubmitted: (_) => _aplicarFiltro(),
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
                  ? const EstadoVazio(mensagem: 'Nenhum produto encontrado.')
                  : Column(
                      children: [
                        for (final ProdutoResumo produto in resultado.data) ...[
                          ListItemTile(
                            titulo: produto.titulo,
                            subtitulo:
                                '${produto.codigo ?? "—"} · ${rotuloTipoProduto(produto.tipo)}',
                            valor: formatarMoeda(produto.precoVenda),
                            tag: BadgeAtivoInativo(inativo: produto.inativo),
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ProdutoDetalheScreen(id: produto.id),
                              ),
                            ),
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
