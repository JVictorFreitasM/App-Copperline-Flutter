import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers/estoque_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';

/// Consulta pontual de estoque (mobile, equivalente à OS-WEB-14) - primeira
/// tela de negócio do app por decisão de escopo (ver
/// `files/OS-MOBILE-pendentes.md`: caso de uso que mais faz sentido em
/// campo/depósito). Busca em tempo real via WK BI (OS-BACKEND-12), não uma
/// listagem paginada de dado sincronizado - por isso usa `estoqueProvider`
/// (Notifier disparado por ação), diferente das telas de clientes/
/// produtos/pedidos.
class EstoqueScreen extends ConsumerStatefulWidget {
  const EstoqueScreen({super.key, this.identificadorInicial});

  // Vindo do atalho "Ver estoque" na tela de detalhe do produto - preenche
  // o campo e dispara a busca sozinho ao abrir (mesmo comportamento do
  // web, ver `frontend/src/app/estoque/busca-estoque.tsx`).
  final String? identificadorInicial;

  @override
  ConsumerState<EstoqueScreen> createState() => _EstoqueScreenState();
}

class _EstoqueScreenState extends ConsumerState<EstoqueScreen> {
  late final _controller = TextEditingController(text: widget.identificadorInicial);

  @override
  void initState() {
    super.initState();
    if (widget.identificadorInicial != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _consultar());
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _consultar() {
    ref.read(estoqueProvider.notifier).consultar(_controller.text);
  }

  @override
  Widget build(BuildContext context) {
    final estado = ref.watch(estoqueProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Consulta de estoque')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Mais pedidos', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 8),
            const _ListaMaisPedidos(),
            const SizedBox(height: 24),
            AppCard(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: const InputDecoration(
                        hintText: 'Código ou ID do produto',
                        border: InputBorder.none,
                      ),
                      onSubmitted: (_) => _consultar(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: estado is EstoqueCarregando ? null : _consultar,
                    child: Text(estado is EstoqueCarregando ? 'Consultando...' : 'Consultar'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            switch (estado) {
              EstoqueIdle() || EstoqueCarregando() => const SizedBox.shrink(),
              EstoqueErro(:final mensagem) => ErroConexao(
                mensagem: mensagem,
                aoTentarNovamente: _consultar,
              ),
              EstoqueNaoEncontrado(:final identificador) => EstadoVazio(
                mensagem: "Produto '$identificador' não encontrado.",
              ),
              EstoqueSemSaldo(:final identificador) => EstadoVazio(
                mensagem: "Produto '$identificador' encontrado, mas sem saldo em estoque.",
              ),
              EstoqueComSaldo(:final resultado, :final offline) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (offline)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        'Sem conexão agora - mostrando o último saldo salvo '
                        '${resultado.atualizadoEm != null ? "(sincronizado em ${resultado.atualizadoEm})" : ""}.',
                        style: const TextStyle(fontSize: 11, color: AppColors.muted),
                      ),
                    ),
                  for (final item in resultado.itens) ...[
                    ListItemTile(
                      titulo: item.tituloLocal,
                      subtitulo: (item.lote != null || item.fabricadoEm != null)
                          ? 'Lote ${item.lote ?? "—"} · Fabricado em ${item.fabricadoEm ?? "—"}'
                          : null,
                      valor: item.quantidade,
                    ),
                    const SizedBox(height: 8),
                  ],
                ],
              ),
            },
            if (estado is EstoqueCarregando) ...[
              const SizedBox(height: 32),
              const Center(child: CircularProgressIndicator(color: AppColors.primary)),
            ],
          ],
        ),
      ),
    );
  }
}

class _ListaMaisPedidos extends ConsumerWidget {
  const _ListaMaisPedidos();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final maisPedidosAsync = ref.watch(produtosMaisPedidosProvider);

    return maisPedidosAsync.when(
      data: (produtos) => produtos.isEmpty
          ? const EstadoVazio(mensagem: 'Nenhum produto com pedido registrado ainda.')
          : Column(
              children: [
                for (final produto in produtos) ...[
                  ListItemTile(
                    titulo: produto.titulo,
                    subtitulo: '${produto.quantidadeTotalPedida.toStringAsFixed(0)} unidade(s) pedida(s)',
                    valor: produto.quantidadeDisponivel != null
                        ? '${produto.quantidadeDisponivel} em estoque'
                        : 'Sem saldo sincronizado',
                  ),
                  const SizedBox(height: 8),
                ],
              ],
            ),
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (erro, _) => ErroConexao(
        mensagem: '$erro',
        aoTentarNovamente: () => ref.invalidate(produtosMaisPedidosProvider),
      ),
    );
  }
}
