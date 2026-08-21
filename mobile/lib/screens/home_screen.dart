import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/auth/auth_notifier.dart';
import '../core/health_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import 'clientes_screen.dart';
import 'estoque_screen.dart';
import 'pedidos_screen.dart';
import 'produtos_screen.dart';

/// Tela inicial (OS-MOBILE-11) - virou o menu das telas de negócio a
/// partir da OS-MOBILE-13/14/15/16 (equivalente mobile de OS-WEB-11 a 15),
/// mesmo papel do `SiteNav` web. Estoque aparece primeiro na lista por
/// decisão de escopo (ver `files/OS-MOBILE-pendentes.md`: caso de uso que
/// mais faz sentido em campo/depósito).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saude = ref.watch(healthProvider);
    final usuario = ref.watch(authProvider).value?.usuario;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Copperline'),
        actions: [
          IconButton(
            tooltip: 'Sair',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            if (usuario != null) ...[
              Text('Olá, ${usuario.name}', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 16),
            ],
            _ItemMenu(
              icone: Icons.inventory_2_outlined,
              titulo: 'Estoque',
              subtitulo: 'Consultar saldo por produto',
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const EstoqueScreen())),
            ),
            const SizedBox(height: 12),
            _ItemMenu(
              icone: Icons.people_outline,
              titulo: 'Clientes',
              subtitulo: 'Buscar cliente por nome ou CPF/CNPJ',
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const ClientesScreen())),
            ),
            const SizedBox(height: 12),
            _ItemMenu(
              icone: Icons.category_outlined,
              titulo: 'Produtos',
              subtitulo: 'Buscar produto por nome, código ou GTIN',
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const ProdutosScreen())),
            ),
            const SizedBox(height: 12),
            _ItemMenu(
              icone: Icons.receipt_long_outlined,
              titulo: 'Pedidos',
              subtitulo: 'Acompanhar pedidos por cliente e situação',
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const PedidosScreen())),
            ),
            const SizedBox(height: 24),
            saude.when(
              data: (status) => _CardSaude(status: status),
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (erro, _) => _CardErro(
                mensagem: erro.toString(),
                aoTentarNovamente: () => ref.read(healthProvider.notifier).recarregar(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ItemMenu extends StatelessWidget {
  const _ItemMenu({
    required this.icone,
    required this.titulo,
    required this.subtitulo,
    required this.onTap,
  });

  final IconData icone;
  final String titulo;
  final String subtitulo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: AppColors.primaryLight,
                child: Icon(icone, color: AppColors.primary),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(titulo, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    const SizedBox(height: 2),
                    Text(subtitulo, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _CardSaude extends StatelessWidget {
  const _CardSaude({required this.status});

  final HealthStatus status;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Icon(
            status.ok ? Icons.check_circle_outline : Icons.error_outline,
            color: status.ok ? AppColors.primary : AppColors.muted,
            size: 18,
          ),
          const SizedBox(width: 8),
          Text('API: ${status.status}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ],
      ),
    );
  }
}

class _CardErro extends StatelessWidget {
  const _CardErro({required this.mensagem, required this.aoTentarNovamente});

  final String mensagem;
  final VoidCallback aoTentarNovamente;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Falha ao conectar com a API',
            style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
          ),
          const SizedBox(height: 4),
          Text(mensagem, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: aoTentarNovamente, child: const Text('Tentar novamente')),
        ],
      ),
    );
  }
}
