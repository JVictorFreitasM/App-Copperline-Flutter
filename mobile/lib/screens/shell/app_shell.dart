import '../../core/providers/sincronizacao_provider.dart';
import '../sincronizacao_screen.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_notifier.dart';
import '../../core/providers/aprovacoes_provider.dart';
import '../../core/providers/notificacoes_provider.dart';
import '../../theme/app_colors.dart';
import '../busca_screen.dart';
import '../clientes_screen.dart';
import '../home_screen.dart';
import '../notificacoes_config_screen.dart';
import '../produtos_screen.dart';
import '../rastreio_config_screen.dart';
import '../roteiro_screen.dart';
import '../tabelas_preco_screen.dart';
import 'coberturas_screen.dart';
import 'documentos_screen.dart';
import 'notas_fiscais_screen.dart';
import 'notificacoes_screen.dart';
import 'oportunidades_screen.dart';
import 'ranking_equipe_screen.dart';
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
  _ItemNav(rotulo: 'Relatório', icone: Icons.assignment_outlined, iconeAtivo: Icons.assignment),
];

class _AppShellState extends ConsumerState<AppShell> {
  int _aba = 0;

  static const _telas = [HomeScreen(), ClientesScreen(), ProdutosScreen(), RelatorioScreen()];

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
      body: Column(
        children: [
          const _FaixaOffline(),
          Expanded(
            child: IndexedStack(index: _aba, children: _telas),
          ),
        ],
      ),
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

// Indicador persistente de "modo offline" (OS-MOBILE-38) - só aparece
// quando a tela está mostrando o cache local ainda não revalidado contra o
// servidor nesta sessão (ver AuthState.usandoCacheOffline), pra o vendedor
// sempre saber se o que está vendo é dado local ou recém-atualizado.
class _FaixaOffline extends ConsumerWidget {
  const _FaixaOffline();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usandoCache = ref.watch(authProvider).value?.usandoCacheOffline ?? false;
    if (!usandoCache) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      color: AppColors.amberLight,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 14, color: AppColors.amber),
          const SizedBox(width: 6),
          const Text(
            'Modo offline - mostrando dados salvos localmente',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.amber),
          ),
        ],
      ),
    );
  }
}

// Intervalo de poll da contagem de não lidas (mesmo critério do sino web,
// `notificacao-sino.tsx`, INTERVALO_POLL_MS = 60s) - trade-off entre "badge
// atualizado" e não martelar o backend; sem push/websocket de contagem em
// tempo real ainda.
const _intervaloPollNotificacoes = Duration(seconds: 60);

class _CabecalhoApp extends ConsumerStatefulWidget implements PreferredSizeWidget {
  const _CabecalhoApp({required this.titulo});

  final String titulo;

  @override
  ConsumerState<_CabecalhoApp> createState() => _CabecalhoAppState();

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class _CabecalhoAppState extends ConsumerState<_CabecalhoApp> {
  Timer? _timerPoll;

  @override
  void initState() {
    super.initState();
    _timerPoll = Timer.periodic(_intervaloPollNotificacoes, (_) {
      ref.invalidate(contagemNaoLidasProvider);
    });
  }

  @override
  void dispose() {
    _timerPoll?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Pedido do usuário (2026-09-30) - antes era um ponto vermelho fixo,
    // decorativo, sem contagem real nenhuma; agora reflete GET
    // /notificacoes/contagem-nao-lidas de verdade (ver
    // notificacoes_provider.dart). Sem badge quando zero/carregando/erro -
    // nunca inventa um número.
    final quantidade = ref.watch(contagemNaoLidasProvider).value ?? 0;
    final sinc = ref.watch(sincronizacaoProvider);

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
          Text(widget.titulo, style: Theme.of(context).textTheme.headlineMedium),
        ],
      ),
      actions: [
        // Estado da sincronização offline: gira enquanto sincroniza, ponto
        // âmbar quando a última falhou/há envios pendentes. Toque abre a tela
        // com o detalhe e o "Sincronizar agora".
        IconButton(
          tooltip: 'Sincronização',
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              sinc.sincronizando
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: Padding(
                        padding: EdgeInsets.all(2),
                        child: CircularProgressIndicator(strokeWidth: 2.2),
                      ),
                    )
                  : const Icon(Icons.sync),
              if (!sinc.sincronizando && (sinc.erro != null || sinc.pendentes > 0))
                Positioned(
                  right: -2,
                  top: -2,
                  child: Container(
                    width: 9,
                    height: 9,
                    decoration: const BoxDecoration(color: AppColors.amber, shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
          onPressed: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const SincronizacaoScreen())),
        ),
        IconButton(
          tooltip: 'Notificações',
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(Icons.notifications_outlined),
              if (quantidade > 0)
                Positioned(
                  right: -4,
                  top: -4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppColors.red,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    constraints: const BoxConstraints(minWidth: 16),
                    child: Text(
                      quantidade > 99 ? '99+' : '$quantidade',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          onPressed: () {
            ref.invalidate(contagemNaoLidasProvider);
            Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const NotificacoesScreen()));
          },
        ),
      ],
    );
  }
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
            // Itens rolam (a lista cresceu e estourava a altura em telas
            // menores - "bottom overflowed"); só o "Sair" fica fixo no rodapé.
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                    // Faltava no mobile (auditoria 2026-09-30) - vendedor não
                    // conseguia ver nem baixar o PDF da NF-e pelo celular, só na
                    // web. Mesmo padrão de item de menu que Documentos acima.
                    _ItemMenu(
                      icone: Icons.receipt_long_outlined,
                      rotulo: 'Notas fiscais',
                      ativo: false,
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(
                          context,
                        ).push(MaterialPageRoute(builder: (_) => const NotasFiscaisScreen()));
                      },
                    ),
                    _ItemMenu(
                      icone: Icons.sell_outlined,
                      rotulo: 'Tabelas de preço',
                      ativo: false,
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(
                          context,
                        ).push(MaterialPageRoute(builder: (_) => const TabelasPrecoScreen()));
                      },
                    ),
                    // Faltavam por completo no mobile (auditoria 2026-09-30) -
                    // Oportunidades, Cobertura e Ranking só existiam na web.
                    _ItemMenu(
                      icone: Icons.lightbulb_outline,
                      rotulo: 'Oportunidades',
                      ativo: false,
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(
                          context,
                        ).push(MaterialPageRoute(builder: (_) => const OportunidadesScreen()));
                      },
                    ),
                    _ItemMenu(
                      icone: Icons.people_alt_outlined,
                      rotulo: 'Cobertura',
                      ativo: false,
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(
                          context,
                        ).push(MaterialPageRoute(builder: (_) => const CoberturasScreen()));
                      },
                    ),
                    _ItemMenu(
                      icone: Icons.leaderboard_outlined,
                      rotulo: 'Ranking de equipe',
                      ativo: false,
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(
                          context,
                        ).push(MaterialPageRoute(builder: (_) => const RankingEquipeScreen()));
                      },
                    ),
                    // Sino do cabeçalho agora abre o histórico de notificações
                    // (NotificacoesScreen), não mais esta tela - configuração de
                    // push em primeiro plano continua existindo, só mudou de lugar.
                    _ItemMenu(
                      icone: Icons.settings_outlined,
                      rotulo: 'Configurar notificações',
                      ativo: false,
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(
                          context,
                        ).push(MaterialPageRoute(builder: (_) => const NotificacoesConfigScreen()));
                      },
                    ),
                  ],
                ),
              ),
            ),
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
