import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/formatacao.dart';
import '../core/providers/clientes_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';

/// Produtos que o cliente pode comprar com o preço de CADA tabela dele -
/// lido só do espelho local (baixado junto com a carteira), então funciona
/// igual com ou sem internet.
class ClienteProdutosPrecosScreen extends ConsumerStatefulWidget {
  const ClienteProdutosPrecosScreen({super.key, required this.clienteId, required this.titulo});

  final String clienteId;
  final String titulo;

  @override
  ConsumerState<ClienteProdutosPrecosScreen> createState() => _ClienteProdutosPrecosScreenState();
}

class _ClienteProdutosPrecosScreenState extends ConsumerState<ClienteProdutosPrecosScreen> {
  String _busca = '';

  @override
  Widget build(BuildContext context) {
    final produtos = ref.watch(produtosDoClienteProvider(widget.clienteId));

    return Scaffold(
      appBar: AppBar(title: const Text('Produtos e preços')),
      body: SafeArea(
        child: produtos.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: ErroConexao(mensagem: '$erro'),
          ),
          data: (todos) {
            final termo = _busca.trim().toLowerCase();
            final filtrados = termo.isEmpty
                ? todos
                : todos
                      .where(
                        (p) => p.nome.toLowerCase().contains(termo) || p.codigo.contains(termo),
                      )
                      .toList();

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(widget.titulo, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                TextField(
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search, size: 18),
                    hintText: 'Buscar produto por nome ou código',
                  ),
                  onChanged: (valor) => setState(() => _busca = valor),
                ),
                const SizedBox(height: 12),
                if (todos.isEmpty)
                  const EstadoVazio(
                    mensagem:
                        'Nenhum preço encontrado para este cliente. Ele pode não ter tabela de '
                        'preço associada, ou os dados offline ainda não foram baixados.',
                  )
                else if (filtrados.isEmpty)
                  const EstadoVazio(mensagem: 'Nenhum produto encontrado.')
                else
                  for (final produto in filtrados) ...[
                    AppCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            produto.nome,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppColors.ink,
                            ),
                          ),
                          Text(
                            'Código ${produto.codigo}',
                            style: const TextStyle(fontSize: 11, color: AppColors.muted),
                          ),
                          const SizedBox(height: 6),
                          for (final entrada in produto.precosPorTabela.entries)
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Tabela ${entrada.key}',
                                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                                ),
                                Text(
                                  formatarMoeda(entrada.value),
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink,
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
              ],
            );
          },
        ),
      ),
    );
  }
}
