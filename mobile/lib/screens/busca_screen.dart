import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/formatacao.dart';
import '../core/models/cliente.dart';
import '../core/models/pedido.dart';
import '../core/models/produto.dart';
import '../core/providers/busca_provider.dart';
import '../core/providers/favoritos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import 'cliente_detalhe_screen.dart';
import 'pedido_detalhe_screen.dart';
import 'produto_detalhe_screen.dart';

/// Busca global unificada (OS-MOBILE-15) - GET /busca (OS-BACKEND-18),
/// resultados agrupados por tipo (cliente/produto/pedido). Campo de busca
/// sempre visível no topo (mesmo enquanto carrega/mostra resultado
/// anterior) - critério de aceite da OS. Sem termo digitado, mostra os
/// favoritos locais (cliente/produto, ver favoritos_provider.dart) em vez
/// de tela vazia - dá utilidade real ao favorito fora do contexto de uma
/// busca específica.
class BuscaScreen extends ConsumerStatefulWidget {
  const BuscaScreen({super.key});

  @override
  ConsumerState<BuscaScreen> createState() => _BuscaScreenState();
}

class _BuscaScreenState extends ConsumerState<BuscaScreen> {
  final _controller = TextEditingController();
  String _termo = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Buscar cliente, produto ou pedido...',
            border: InputBorder.none,
          ),
          onChanged: (valor) => setState(() => _termo = valor.trim()),
        ),
      ),
      body: SafeArea(
        child: _termo.isEmpty
            ? const _ListaFavoritos()
            : _ResultadoBusca(termo: _termo),
      ),
    );
  }
}

class _ResultadoBusca extends ConsumerWidget {
  const _ResultadoBusca({required this.termo});

  final String termo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultado = ref.watch(buscaProvider(termo));

    return resultado.when(
      data: (dados) => dados.vazio
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: EstadoVazio(mensagem: 'Nenhum resultado encontrado.'),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (dados.clientes.isNotEmpty) ...[
                  const _TituloSecao('Clientes'),
                  for (final cliente in dados.clientes) ...[
                    _ItemCliente(cliente: cliente),
                    const SizedBox(height: 8),
                  ],
                  const SizedBox(height: 8),
                ],
                if (dados.produtos.isNotEmpty) ...[
                  const _TituloSecao('Produtos'),
                  for (final produto in dados.produtos) ...[
                    _ItemProduto(produto: produto),
                    const SizedBox(height: 8),
                  ],
                  const SizedBox(height: 8),
                ],
                if (dados.pedidos.isNotEmpty) ...[
                  const _TituloSecao('Pedidos'),
                  for (final pedido in dados.pedidos) ...[
                    _ItemPedido(pedido: pedido),
                    const SizedBox(height: 8),
                  ],
                ],
              ],
            ),
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (erro, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: ErroConexao(
          mensagem: erro.toString(),
          aoTentarNovamente: () => ref.invalidate(buscaProvider(termo)),
        ),
      ),
    );
  }
}

class _ListaFavoritos extends ConsumerWidget {
  const _ListaFavoritos();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favoritos = ref.watch(favoritosProvider);

    return favoritos.when(
      data: (dados) {
        final clientesIds = dados[TipoFavorito.cliente] ?? const {};
        final produtosIds = dados[TipoFavorito.produto] ?? const {};
        if (clientesIds.isEmpty && produtosIds.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: EstadoVazio(
              mensagem: 'Nenhum favorito ainda - toque na estrela de um cliente ou produto pra guardar aqui.',
            ),
          );
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (clientesIds.isNotEmpty) ...[
              const _TituloSecao('Clientes favoritos'),
              for (final id in clientesIds) ...[
                _ItemFavoritoSimples(
                  tipo: TipoFavorito.cliente,
                  id: id,
                  onTap: () => Navigator.of(
                    context,
                  ).push(MaterialPageRoute(builder: (_) => ClienteDetalheScreen(id: id))),
                ),
                const SizedBox(height: 8),
              ],
              const SizedBox(height: 8),
            ],
            if (produtosIds.isNotEmpty) ...[
              const _TituloSecao('Produtos favoritos'),
              for (final id in produtosIds) ...[
                _ItemFavoritoSimples(
                  tipo: TipoFavorito.produto,
                  id: id,
                  onTap: () => Navigator.of(
                    context,
                  ).push(MaterialPageRoute(builder: (_) => ProdutoDetalheScreen(id: id))),
                ),
                const SizedBox(height: 8),
              ],
            ],
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (erro, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: ErroConexao(mensagem: erro.toString()),
      ),
    );
  }
}

// Favorito guardado só como id (sem nome/dado cacheado localmente) - o
// nome real só se sabe consultando a API. Sem endpoint novo nesta fase
// (escopo explícito da OS-MOBILE-15) pra buscar vários por id de uma vez,
// então o item mostra o id como identificador provisório; abrir o item
// carrega o detalhe completo normalmente.
class _ItemFavoritoSimples extends ConsumerWidget {
  const _ItemFavoritoSimples({required this.tipo, required this.id, required this.onTap});

  final TipoFavorito tipo;
  final String id;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListItemTile(
      titulo: id,
      subtitulo: tipo == TipoFavorito.cliente ? 'Cliente' : 'Produto',
      onTap: onTap,
      trailingAction: _BotaoFavorito(tipo: tipo, id: id),
    );
  }
}

class _ItemCliente extends ConsumerWidget {
  const _ItemCliente({required this.cliente});

  final ClienteResumo cliente;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListItemTile(
      titulo: cliente.titulo,
      subtitulo: cliente.cpfCnpj ?? 'Sem CPF/CNPJ',
      tag: AppBadge(texto: cliente.inativo ? 'Inativo' : 'Ativo', enfase: !cliente.inativo),
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => ClienteDetalheScreen(id: cliente.id))),
      trailingAction: _BotaoFavorito(tipo: TipoFavorito.cliente, id: cliente.id),
    );
  }
}

class _ItemProduto extends ConsumerWidget {
  const _ItemProduto({required this.produto});

  final ProdutoResumo produto;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListItemTile(
      titulo: produto.nome ?? produto.codigo ?? '—',
      subtitulo: produto.codigo,
      valor: formatarMoeda(produto.precoVenda),
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => ProdutoDetalheScreen(id: produto.id))),
      trailingAction: _BotaoFavorito(tipo: TipoFavorito.produto, id: produto.id),
    );
  }
}

class _ItemPedido extends StatelessWidget {
  const _ItemPedido({required this.pedido});

  final PedidoResumo pedido;

  @override
  Widget build(BuildContext context) {
    final situacaoConfig = configSituacaoPedido(pedido.situacao);
    return ListItemTile(
      titulo: pedido.tituloCliente,
      subtitulo: 'Pedido ${pedido.numero ?? "—"} · ${formatarData(pedido.dataHoraUltimaAlteracao)}',
      valor: formatarMoeda(pedido.valorTotal),
      tag: AppBadge(texto: situacaoConfig.rotulo, enfase: situacaoConfig.enfase),
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => PedidoDetalheScreen(id: pedido.id))),
    );
  }
}

class _BotaoFavorito extends ConsumerWidget {
  const _BotaoFavorito({required this.tipo, required this.id});

  final TipoFavorito tipo;
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.watch(favoritosProvider.notifier);
    final ehFavorito = ref.watch(
      favoritosProvider.select((estado) => estado.value?[tipo]?.contains(id) ?? false),
    );

    return IconButton(
      icon: Icon(
        ehFavorito ? Icons.star : Icons.star_border,
        color: ehFavorito ? AppColors.primary : AppColors.muted,
      ),
      tooltip: ehFavorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos',
      onPressed: () => notifier.alternar(tipo, id),
    );
  }
}

class _TituloSecao extends StatelessWidget {
  const _TituloSecao(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        texto,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.ink),
      ),
    );
  }
}
