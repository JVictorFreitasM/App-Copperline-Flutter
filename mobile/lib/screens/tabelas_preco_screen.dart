import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/formatacao.dart';
import '../core/models/tabela_preco.dart';
import '../core/providers/tabelas_preco_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import 'tabela_preco_detalhe_screen.dart';

/// Tabelas de preço sincronizadas via Empresarial.svc/BuscarTabelasPreco
/// (mesmo padrão do web, `frontend/src/app/tabelas-preco/page.tsx`) - so
/// leitura (editar qual tabela é a padrão fica restrito ao painel web,
/// pedido do usuário).
class TabelasPrecoScreen extends ConsumerWidget {
  const TabelasPrecoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabelasAsync = ref.watch(tabelasPrecoProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tabelas de preço')),
      body: SafeArea(
        child: tabelasAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: ErroConexao(
              mensagem: '$erro',
              aoTentarNovamente: () => ref.invalidate(tabelasPrecoProvider),
            ),
          ),
          data: (tabelas) => tabelas.isEmpty
              ? const EstadoVazio(mensagem: 'Nenhuma tabela de preço sincronizada ainda.')
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    for (final TabelaPrecoResumo tabela in tabelas) ...[
                      ListItemTile(
                        titulo: 'Tabela ${tabela.codigo}',
                        subtitulo:
                            '${tabela.quantidadeItens} item(ns) · sincronizada em '
                            '${formatarDataHora(tabela.sincronizadoEm)}',
                        valor: tabela.padrao ? 'Padrão' : null,
                        tag: tabela.padrao
                            ? const AppBadge(texto: 'Padrão', enfase: true)
                            : (!tabela.ativa ? const AppBadge(texto: 'Inativa') : null),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => TabelaPrecoDetalheScreen(id: tabela.id),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}
