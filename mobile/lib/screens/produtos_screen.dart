import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/formatacao.dart';
import '../core/models/produto.dart';
import '../core/providers/produtos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/pagination_bar.dart';
import 'produto_detalhe_screen.dart';

/// Aba "Produtos" - replica a referência "Nexo Comercial"
/// (Downloads/aplicativo-comercial-interno, tela produto.jpg): busca +
/// banner de catálogo + lista com preço em destaque. Consome GET /produtos
/// (OS-BACKEND-11). A referência mostra "1.248 itens disponíveis" no
/// banner - omitido de propósito: a API não devolve contagem total, só
/// totalPages (ver PaginatedResult), não dá pra inventar o número.
class ProdutosScreen extends ConsumerStatefulWidget {
  const ProdutosScreen({super.key});

  @override
  ConsumerState<ProdutosScreen> createState() => _ProdutosScreenState();
}

class _ProdutosScreenState extends ConsumerState<ProdutosScreen> {
  int _pagina = 1;
  final _buscaController = TextEditingController();
  String? _nome;
  String? _codigo;

  @override
  void dispose() {
    _buscaController.dispose();
    super.dispose();
  }

  void _aplicarBusca() {
    final texto = _buscaController.text.trim();
    final pareceCodigo = RegExp(r'^\d+$').hasMatch(texto);
    setState(() {
      _pagina = 1;
      _codigo = pareceCodigo ? texto : null;
      _nome = pareceCodigo ? null : texto;
    });
  }

  @override
  Widget build(BuildContext context) {
    final params = (pagina: _pagina, nome: _nome, codigo: _codigo, gtin: null);
    final resultadoAsync = ref.watch(produtosProvider(params));

    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              const Icon(Icons.search, size: 17, color: AppColors.muted),
              const SizedBox(width: 9),
              Expanded(
                child: TextField(
                  controller: _buscaController,
                  decoration: const InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    hintText: 'Buscar produto ou código',
                    hintStyle: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                  style: const TextStyle(fontSize: 12),
                  onSubmitted: (_) => _aplicarBusca(),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.navy,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'CATÁLOGO',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        color: Color(0xFFB7C7CF),
                      ),
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      'Produtos da carteira',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Busque por nome ou código.',
                      style: const TextStyle(color: Color(0xFFB7C7CF), fontSize: 10),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.inventory_2_outlined, color: Color(0xFF6DA5ED), size: 30),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Resultados',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
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
                      _LinhaProduto(produto: produto),
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
    );
  }
}

class _LinhaProduto extends StatelessWidget {
  const _LinhaProduto({required this.produto});

  final ProdutoResumo produto;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => ProdutoDetalheScreen(id: produto.id))),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8EDF1),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.inventory_2_outlined, size: 17, color: AppColors.navy),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      produto.titulo,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${produto.codigo ?? "—"} · ${rotuloTipoProduto(produto.tipo)}'
                      '${produto.inativo ? " · Inativo" : ""}',
                      style: const TextStyle(fontSize: 10, color: AppColors.muted),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Text(
                formatarMoeda(produto.precoVenda),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
