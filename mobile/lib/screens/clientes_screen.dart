import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers/clientes_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/pagination_bar.dart';
import '../widgets/status_badge.dart';
import 'cliente_detalhe_screen.dart';
import 'verificar_conflito_screen.dart';

/// Aba "Clientes" - replica a referência "Nexo Comercial"
/// (Downloads/aplicativo-comercial-interno, tela 2.jpg): barra de busca +
/// lista com marca/nome/status. Consome GET /clientes (OS-BACKEND-11),
/// mesmo provider de antes desta troca de referência - só o visual mudou.
/// A referência mostra pills de filtro com contagem fixa ("Com pedido 12",
/// "Sem visita 08") - omitidas de propósito: o backend não tem esse
/// agregado, seria inventar número.
class ClientesScreen extends ConsumerStatefulWidget {
  const ClientesScreen({super.key});

  @override
  ConsumerState<ClientesScreen> createState() => _ClientesScreenState();
}

class _ClientesScreenState extends ConsumerState<ClientesScreen> {
  int _pagina = 1;
  final _buscaController = TextEditingController();
  String? _nome;
  String? _cpfCnpj;

  @override
  void dispose() {
    _buscaController.dispose();
    super.dispose();
  }

  // Um campo só, como a referência ("Buscar por nome ou CNPJ") - o
  // backend precisa de parâmetros separados (nome/cpfCnpj), então decide
  // aqui pra qual mandar: texto majoritariamente numérico vira busca por
  // documento, senão por nome.
  void _aplicarBusca() {
    final texto = _buscaController.text.trim();
    final digitos = texto.replaceAll(RegExp(r'\D'), '');
    setState(() {
      _pagina = 1;
      if (texto.isNotEmpty && digitos.length >= texto.length - 2) {
        _cpfCnpj = texto;
        _nome = null;
      } else {
        _nome = texto;
        _cpfCnpj = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final params = (pagina: _pagina, nome: _nome, cpfCnpj: _cpfCnpj);
    final resultadoAsync = ref.watch(clientesProvider(params));

    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Row(
          children: [
            Expanded(
              child: Container(
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
                          hintText: 'Buscar por nome ou CNPJ',
                          hintStyle: TextStyle(color: AppColors.muted, fontSize: 12),
                        ),
                        style: const TextStyle(fontSize: 12),
                        onSubmitted: (_) => _aplicarBusca(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            Material(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const VerificarConflitoScreen())),
                child: Container(
                  height: 44,
                  width: 44,
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.line),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.person_search_outlined,
                    size: 18,
                    color: AppColors.muted,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const Text(
          'Minha carteira',
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
                      _LinhaCliente(cliente: cliente),
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

class _LinhaCliente extends StatelessWidget {
  const _LinhaCliente({required this.cliente});

  final dynamic cliente;

  @override
  Widget build(BuildContext context) {
    final titulo = cliente.titulo as String;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => ClienteDetalheScreen(id: cliente.id))),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  titulo.isNotEmpty ? titulo.substring(0, 1).toUpperCase() : '?',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      titulo,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      cliente.cpfCnpj ?? 'Sem CPF/CNPJ',
                      style: const TextStyle(fontSize: 11, color: AppColors.muted),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              StatusBadge(
                texto: cliente.inativo ? 'Inativo' : 'Ativo',
                tom: cliente.inativo ? Tom.atencao : Tom.ok,
              ),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right, size: 16, color: Color(0xFF9AA8B1)),
            ],
          ),
        ),
      ),
    );
  }
}
