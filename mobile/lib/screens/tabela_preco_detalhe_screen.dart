import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/formatacao.dart';
import '../core/models/tabela_preco.dart';
import '../core/providers/tabelas_preco_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/pagination_bar.dart';

class TabelaPrecoDetalheScreen extends ConsumerStatefulWidget {
  const TabelaPrecoDetalheScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<TabelaPrecoDetalheScreen> createState() => _TabelaPrecoDetalheScreenState();
}

class _TabelaPrecoDetalheScreenState extends ConsumerState<TabelaPrecoDetalheScreen> {
  int _pagina = 1;

  @override
  Widget build(BuildContext context) {
    final tabelaAsync = ref.watch(tabelaPrecoDetalheProvider(widget.id));
    final itensAsync = ref.watch(
      itensTabelaPrecoProvider((tabelaId: widget.id, pagina: _pagina)),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Tabela de preço')),
      body: SafeArea(
        child: tabelaAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 404
                ? EstadoVazio(mensagem: "Tabela '${widget.id}' não encontrada.")
                : ErroConexao(mensagem: '$erro'),
          ),
          data: (tabela) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Tabela ${tabela.codigo}',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 4),
              Text(
                '${tabela.quantidadeItens} item(ns) · sincronizada em '
                '${formatarDataHora(tabela.sincronizadoEm)}',
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 20),
              Text('Itens', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              itensAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator(color: AppColors.primary)),
                error: (erro, _) => ErroConexao(
                  mensagem: '$erro',
                  aoTentarNovamente: () => setState(() {}),
                ),
                data: (itens) => itens.data.isEmpty
                    ? const EstadoVazio(mensagem: 'Nenhum item nesta tabela.')
                    : Column(
                        children: [
                          for (final ItemTabelaPreco item in itens.data) ...[
                            ListItemTile(
                              titulo: 'Código ${item.codigoItem}',
                              subtitulo: item.dataUltimoReajuste != null
                                  ? 'Último reajuste em ${formatarData(item.dataUltimoReajuste)}'
                                  : null,
                              valor: formatarMoeda(item.preco),
                              tag: item.precoPromocional != null &&
                                      double.tryParse(item.precoPromocional!) != null &&
                                      double.parse(item.precoPromocional!) > 0
                                  ? AppBadge(
                                      texto: 'Promo: ${formatarMoeda(item.precoPromocional)}',
                                      enfase: true,
                                    )
                                  : null,
                            ),
                            const SizedBox(height: 8),
                          ],
                          const SizedBox(height: 8),
                          PaginationBar(
                            pagina: itens.page,
                            totalPaginas: itens.totalPages,
                            aoMudarPagina: (p) => setState(() => _pagina = p),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
