import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers/clientes_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/pagination_bar.dart';
import 'cliente_detalhe_screen.dart';
import 'verificar_conflito_screen.dart';

/// Listagem de clientes (mobile, equivalente à OS-WEB-11) - consome
/// GET /clientes (OS-BACKEND-11). Filtro/paginação são estado efêmero de UI
/// (`State` local); o resultado em si é estado de negócio, vem do
/// `clientesProvider` (`FutureProvider.family`, ver skill `flutter-widget`).
class ClientesScreen extends ConsumerStatefulWidget {
  const ClientesScreen({super.key});

  @override
  ConsumerState<ClientesScreen> createState() => _ClientesScreenState();
}

class _ClientesScreenState extends ConsumerState<ClientesScreen> {
  int _pagina = 1;
  final _nomeController = TextEditingController();
  final _cpfCnpjController = TextEditingController();
  String? _nome;
  String? _cpfCnpj;

  @override
  void dispose() {
    _nomeController.dispose();
    _cpfCnpjController.dispose();
    super.dispose();
  }

  void _aplicarFiltro() {
    setState(() {
      _pagina = 1;
      _nome = _nomeController.text;
      _cpfCnpj = _cpfCnpjController.text;
    });
  }

  @override
  Widget build(BuildContext context) {
    final params = (pagina: _pagina, nome: _nome, cpfCnpj: _cpfCnpj);
    final resultadoAsync = ref.watch(clientesProvider(params));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Clientes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_search_outlined),
            tooltip: 'Verificar conflito por CPF/CNPJ',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const VerificarConflitoScreen()),
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
                    controller: _nomeController,
                    decoration: const InputDecoration(labelText: 'Nome / Razão social'),
                    onSubmitted: (_) => _aplicarFiltro(),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _cpfCnpjController,
                    decoration: const InputDecoration(labelText: 'CPF/CNPJ'),
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
                  ? Column(
                      children: [
                        const EstadoVazio(mensagem: 'Nenhum cliente encontrado.'),
                        if (_cpfCnpj != null && _cpfCnpj!.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          TextButton.icon(
                            icon: const Icon(Icons.person_search_outlined, size: 18),
                            label: const Text('Verificar conflito antes de prospectar'),
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => const VerificarConflitoScreen(),
                              ),
                            ),
                          ),
                        ],
                      ],
                    )
                  : Column(
                      children: [
                        for (final cliente in resultado.data) ...[
                          ListItemTile(
                            titulo: cliente.titulo,
                            subtitulo: cliente.cpfCnpj ?? 'Sem CPF/CNPJ',
                            tag: BadgeAtivoInativo(inativo: cliente.inativo),
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ClienteDetalheScreen(id: cliente.id),
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
