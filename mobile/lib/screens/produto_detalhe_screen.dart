import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/formatacao.dart';
import '../core/models/produto.dart';
import '../core/providers/produtos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';
import 'estoque_screen.dart';

/// Detalhe do produto (mobile, equivalente à OS-WEB-15) - mostra o que a
/// listagem não mostra: grade. Atalho "Ver estoque" reaproveita a mesma
/// tela de consulta (`EstoqueScreen`) já preenchendo o código - mesma
/// motivação do web (`frontend/src/app/produtos/[id]/page.tsx`): produto
/// e estoque são serviços diferentes (WK Radar vs. WK BI), o atalho evita
/// o usuário ter que digitar o código de novo.
class ProdutoDetalheScreen extends ConsumerWidget {
  const ProdutoDetalheScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final produtoAsync = ref.watch(produtoDetalheProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Produto')),
      body: SafeArea(
        child: produtoAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 404
                ? EstadoVazio(mensagem: "Produto '$id' não encontrado.")
                : ErroConexao(mensagem: '$erro'),
          ),
          data: (produto) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(produto.titulo, style: Theme.of(context).textTheme.headlineSmall),
                  ),
                  BadgeAtivoInativo(inativo: produto.inativo),
                ],
              ),
              const SizedBox(height: 8),
              if (produto.codigo != null)
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => EstoqueScreen(identificadorInicial: produto.codigo),
                      ),
                    ),
                    child: const Text('Ver estoque'),
                  ),
                ),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Preço de venda', style: TextStyle(color: AppColors.muted)),
                    Text(
                      formatarMoeda(produto.precoVenda),
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Código: ${produto.codigo ?? "—"}'),
                    const SizedBox(height: 4),
                    Text('Tipo: ${rotuloTipoProduto(produto.tipo)}'),
                    const SizedBox(height: 4),
                    Text('GTIN: ${produto.gtin ?? "—"}'),
                    if (produto.tipoAcondicionamentoId != null) ...[
                      const SizedBox(height: 4),
                      Consumer(
                        builder: (context, ref, _) {
                          final tiposAsync = ref.watch(tiposAcondicionamentoProvider);
                          return tiposAsync.when(
                            loading: () => const Text('Acondicionamento: carregando...'),
                            error: (_, _) => const Text('Acondicionamento: —'),
                            data: (tipos) {
                              final tipo = tipos
                                  .where((t) => t.id == produto.tipoAcondicionamentoId)
                                  .firstOrNull;
                              return Text('Acondicionamento: ${tipo?.descricao ?? "—"}');
                            },
                          );
                        },
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _PrecosPorTabela(produtoId: produto.id),
              if (produto.temGrade) ...[
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Grade', style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      if (produto.idGrade1 != null) Text('Grade 1: ${produto.idGrade1}'),
                      if (produto.idGrade2 != null) Text('Grade 2: ${produto.idGrade2}'),
                      if (produto.idGrade3 != null) Text('Grade 3: ${produto.idGrade3}'),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// "Comparativo de preço por tabela" (OS-novas-implementacoes.md Bloco 1,
/// equivalente a `frontend/src/app/produtos/[id]/precos-por-tabela.tsx`) -
/// sem clienteId (mesmo escopo do web hoje: compara contra toda tabela
/// ativa, a variante escopada por cliente fica pra quando existir um fluxo
/// de pedido com cliente em contexto). Falha na consulta não quebra o
/// resto da tela (mesmo critério do web - silenciosamente não mostra a
/// seção), já que é um complemento, não o dado principal da tela.
class _PrecosPorTabela extends ConsumerWidget {
  const _PrecosPorTabela({required this.produtoId});

  final String produtoId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final precosAsync = ref.watch(produtoPrecosProvider(produtoId));

    return precosAsync.when(
      loading: () => const AppCard(
        child: Text('Carregando preços por tabela...', style: TextStyle(color: AppColors.muted)),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (precos) {
        if (precos.isEmpty) return const SizedBox.shrink();
        return AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Preço por tabela', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              for (final preco in precos) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Tabela ${preco.codigo}', style: const TextStyle(color: AppColors.muted)),
                    Text(
                      preco.preco != null ? formatarMoeda(preco.preco) : '—',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
              ],
            ],
          ),
        );
      },
    );
  }
}
