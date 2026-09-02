import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_notifier.dart';
import '../../core/providers/aprovacoes_provider.dart';
import '../../theme/app_colors.dart';
import '../busca_screen.dart';
import '../clientes_screen.dart';
import '../home_screen.dart';
import '../notificacoes_config_screen.dart';
import '../produtos_screen.dart';
import '../rastreio_config_screen.dart';
import '../roteiro_screen.dart';
import 'documentos_screen.dart';
import 'relatorio_screen.dart';

/// Casca de navegação (replica a referência "Nexo Comercial",
/// Downloads/aplicativo-comercial-interno) - barra inferior com as 4
/// seções principais + menu lateral (ícone de hambúrguer) com a navegação
/// completa (inclui Mapa, que não cabe na barra inferior) e Sair. Antes
/// desta mudança o app não tinha shell nenhum - cada tela era empilhada
/// solta via Navigator.push a partir da home; a home e as demais telas
/// continuam existindo como widgets próprios, só passam a viver DENTRO
/// deste shell (IndexedStack preserva o estado de cada aba ao trocar).
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _ItemNav {
  const _ItemNav({required this.rotulo, required this.icone, required this.iconeAtivo});
  final String rotulo;
  final IconData icone;
  final IconData iconeAtivo;
}

const _itensNavPrincipal = [
  _ItemNav(rotulo: 'Início', icone: Icons.home_outlined, iconeAtivo: Icons.home),
  _ItemNav(rotulo: 'Clientes', icone: Icons.people_outline, iconeAtivo: Icons.people),
  _ItemNav(rotulo: 'Produtos', icone: Icons.inventory_2_outlined, iconeAtivo: Icons.inventory_2),
  _ItemNav(
    rotulo: 'Relatório',
    icone: Icons.assignment_outlined,
    iconeAtivo: Icons.assignment,
  ),
];

class _AppShellState extends ConsumerState<AppShell> {
  int _aba = 0;

  static const _telas = [
    HomeScreen(),
    ClientesScreen(),
    ProdutosScreen(),
    RelatorioScreen(),
  ];

  static const _titulos = ['Início', 'Clientes', 'Produtos', 'Relatório'];

  void _irPara(int aba) {
    setState(() => _aba = aba);
    Navigator.of(context).maybePop(); // fecha o drawer se veio de lá
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _CabecalhoApp(titulo: _titulos[_aba]),
      drawer: _MenuLateral(abaAtual: _aba, aoSelecionar: _irPara),
      body: IndexedStack(index: _aba, children: _telas),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _aba,
        onDestinationSelected: (i) => setState(() => _aba = i),
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.primaryLight,
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          for (final item in _itensNavPrincipal)
            NavigationDestination(
              icon: Icon(item.icone, color: AppColors.muted),
              selectedIcon: Icon(item.iconeAtivo, color: AppColors.primary),
              label: item.rotulo,
            ),
        ],
      ),
    );
  }
}

class _CabecalhoApp extends StatelessWidget implements PreferredSizeWidget {
  const _CabecalhoApp({required this.titulo});

  final String titulo;

  @override
  Widget build(BuildContext context) {
    return AppBar(
      titleSpacing: 4,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'COPPERLINE',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: AppColors.muted,
            ),
          ),
          Text(titulo, style: Theme.of(context).textTheme.headlineMedium),
        ],
      ),
      actions: [
        IconButton(
          tooltip: 'Notificações',
          icon: const Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(Icons.notifications_outlined),
              Positioned(
                right: -1,
                top: -1,
                child: CircleAvatar(radius: 4, backgroundColor: AppColors.red),
              ),
            ],
          ),
          onPressed: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const NotificacoesConfigScreen())),
        ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class _MenuLateral extends ConsumerWidget {
  const _MenuLateral({required this.abaAtual, required this.aoSelecionar});

  final int abaAtual;
  final void Function(int) aoSelecionar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(authProvider).value?.usuario;
    final papel = ref.watch(meuVendedorProvider).value?.papel;

    return Drawer(
      backgroundColor: AppColors.navy,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 18),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'C',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'COPPERLINE',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            if (usuario != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 14),
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: Colors.white24),
                    bottom: BorderSide(color: Colors.white24),
                  ),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 19,
                      backgroundColor: const Color(0xFFC7E0FB),
                      child: Text(
                        _iniciais(usuario.name),
                        style: const TextStyle(
                          color: Color(0xFF17466E),
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            usuario.name,
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (papel != null)
                            Text(
                              _rotuloPapel(papel),
                              style: const TextStyle(color: Colors.white60, fontSize: 11),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 6),
            for (var i = 0; i < _itensNavPrincipal.length; i++)
              _ItemMenu(
                icone: _itensNavPrincipal[i].icone,
                rotulo: _itensNavPrincipal[i].rotulo,
                ativo: i == abaAtual,
                onTap: () => aoSelecionar(i),
              ),
            _ItemMenu(
              icone: Icons.map_outlined,
              rotulo: 'Mapa',
              ativo: false,
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const RoteiroScreen()));
              },
            ),
            _ItemMenu(
              icone: Icons.search,
              rotulo: 'Buscar',
              ativo: false,
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const BuscaScreen()));
              },
            ),
            _ItemMenu(
              icone: Icons.my_location_outlined,
              rotulo: 'Rastreio',
              ativo: false,
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const RastreioConfigScreen()));
              },
            ),
            // Faltava no menu lateral (OS-ajustes-layout-mobile, item 5) -
            // só existia como card de acesso rápido na Home. Mesmo padrão
            // de Mapa/Buscar/Rastreio acima.
            _ItemMenu(
              icone: Icons.description_outlined,
              rotulo: 'Documentos',
              ativo: false,
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const DocumentosScreen()));
              },
            ),
            const Spacer(),
            const Divider(color: Colors.white24, height: 1),
            _ItemMenu(
              icone: Icons.logout,
              rotulo: 'Sair',
              ativo: false,
              onTap: () => ref.read(authProvider.notifier).logout(),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  String _iniciais(String nome) {
    final partes = nome.trim().split(RegExp(r'\s+'));
    if (partes.isEmpty) return '?';
    if (partes.length == 1) return partes.first.substring(0, 1).toUpperCase();
    return (partes.first.substring(0, 1) + partes.last.substring(0, 1)).toUpperCase();
  }

  String _rotuloPapel(String papel) => switch (papel) {
    'GERENTE' => 'Gerente',
    'SUPERVISOR' => 'Supervisor',
    _ => 'Vendedor',
  };
}

class _ItemMenu extends StatelessWidget {
  const _ItemMenu({
    required this.icone,
    required this.rotulo,
    required this.ativo,
    required this.onTap,
  });

  final IconData icone;
  final String rotulo;
  final bool ativo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 3),
      child: Material(
        color: ativo ? AppColors.primary : Colors.transparent,
        borderRadius: BorderRadius.circular(9),
        child: InkWell(
          borderRadius: BorderRadius.circular(9),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Icon(icone, size: 18, color: ativo ? Colors.white : const Color(0xFFDBE8EE)),
                const SizedBox(width: 12),
                Text(
                  rotulo,
                  style: TextStyle(
                    color: ativo ? Colors.white : const Color(0xFFDBE8EE),
                    fontWeight: ativo ? FontWeight.w700 : FontWeight.normal,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
