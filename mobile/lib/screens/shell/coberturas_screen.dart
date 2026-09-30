import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/formatacao.dart';
import '../../core/models/cobertura.dart';
import '../../core/providers/coberturas_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/app_card.dart';
import '../../widgets/listagem_feedback.dart';

/// Tela "Cobertura" (equivalente à `frontend/src/app/coberturas/page.tsx`)
/// - só o fluxo do vendedor SUBSTITUTO (GET /coberturas/minha-ativa +
/// /:id/resumo); CRUD de admin (`/admin/coberturas`, ApiKeyGuard) fica
/// fora de escopo do mobile, mesmo critério de outros `/admin/*`.
class CoberturasScreen extends ConsumerWidget {
  const CoberturasScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coberturaAsync = ref.watch(minhaCoberturaAtivaProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Cobertura')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            coberturaAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              ),
              error: (erro, _) => ErroConexao(
                mensagem: '$erro',
                aoTentarNovamente: () => ref.invalidate(minhaCoberturaAtivaProvider),
              ),
              data: (cobertura) => cobertura == null
                  ? const EstadoVazio(mensagem: 'Você não está cobrindo a carteira de ninguém agora.')
                  : _CoberturaAtiva(cobertura: cobertura),
            ),
          ],
        ),
      ),
    );
  }
}

class _CoberturaAtiva extends ConsumerWidget {
  const _CoberturaAtiva({required this.cobertura});

  final CoberturaTemporaria cobertura;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resumoAsync = ref.watch(coberturaResumoProvider(cobertura.id));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Você está cobrindo a carteira de '
                      '${cobertura.vendedorOriginalNome ?? "—"}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  AppBadge(texto: cobertura.ativa ? 'Ativa' : 'Encerrada', enfase: cobertura.ativa),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${formatarData(cobertura.dataInicio)} até '
                '${formatarData(cobertura.dataFim)}',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text('Clientes', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        resumoAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Column(
              children: [
                CircularProgressIndicator(color: AppColors.primary),
                SizedBox(height: 8),
                Text(
                  'Gerando resumo dos clientes (pode levar alguns segundos)...',
                  style: TextStyle(fontSize: 11, color: AppColors.muted),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          error: (erro, _) => ErroConexao(
            mensagem: '$erro',
            aoTentarNovamente: () => ref.invalidate(coberturaResumoProvider(cobertura.id)),
          ),
          data: (resumo) => resumo.clientes.isEmpty
              ? const EstadoVazio(mensagem: 'Nenhum cliente vinculado a esta carteira.')
              : Column(
                  children: [
                    for (final cliente in resumo.clientes) ...[
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              cliente.clienteNome ?? '—',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              cliente.resumo ?? 'Resumo indisponível.',
                              style: const TextStyle(fontSize: 12, color: AppColors.muted),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}
