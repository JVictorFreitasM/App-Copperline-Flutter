import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/formatacao.dart';
import '../core/providers/aprovacoes_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';

/// Tela de aprovações pendentes (OS-MOBILE-26) - fecha no app o ciclo já
/// existente no backend (OS-BACKEND-22) e no web (OS-WEB-21): supervisor/
/// gerente aprova ou rejeita desconto acima do limite direto pelo celular.
/// Sessão SSO normal (sem gate de role aqui) - a decisão de quem PODE
/// decidir cada solicitação é toda do backend
/// (SolicitacoesDescontoService/VendedorEscopoService); um 403 vira "sem
/// permissão de aprovação", não um erro genérico.
class AprovacoesScreen extends ConsumerStatefulWidget {
  const AprovacoesScreen({super.key});

  @override
  ConsumerState<AprovacoesScreen> createState() => _AprovacoesScreenState();
}

class _AprovacoesScreenState extends ConsumerState<AprovacoesScreen> {
  String? _processandoId;

  Future<void> _decidir(String id, {required bool aprovar}) async {
    setState(() => _processandoId = id);
    try {
      final service = ref.read(solicitacoesDescontoServiceProvider);
      if (aprovar) {
        await service.aprovar(id);
      } else {
        await service.rejeitar(id);
      }
      ref.invalidate(solicitacoesPendentesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(aprovar ? 'Desconto aprovado.' : 'Desconto rejeitado.')),
        );
      }
    } on ApiException catch (erro) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(erro.message)));
      }
    } finally {
      if (mounted) setState(() => _processandoId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final solicitacoes = ref.watch(solicitacoesPendentesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Aprovações')),
      body: SafeArea(
        child: solicitacoes.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 403
                ? const EstadoVazio(
                    mensagem:
                        'Você não tem papel de supervisão (supervisor ou gerente) - '
                        'nenhuma solicitação de equipe para aprovar aqui.',
                  )
                : ErroConexao(
                    mensagem: '$erro',
                    aoTentarNovamente: () => ref.invalidate(solicitacoesPendentesProvider),
                  ),
          ),
          data: (dados) => dados.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(16),
                  child: EstadoVazio(mensagem: 'Nenhuma solicitação de desconto pendente.'),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(solicitacoesPendentesProvider);
                    await ref.read(solicitacoesPendentesProvider.future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: dados.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, indice) {
                      final solicitacao = dados[indice];
                      final processando = _processandoId == solicitacao.id;
                      return AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              solicitacao.vendedorSolicitante.nome ?? 'Vendedor não identificado',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: AppColors.ink,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              solicitacao.pedido?.cliente?.razaoSocial ?? 'Cliente não identificado',
                              style: const TextStyle(fontSize: 12, color: AppColors.muted),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${solicitacao.percentualSolicitado.toStringAsFixed(1)}% de desconto'
                              '${solicitacao.pedido?.valorTotal != null ? ' · ${formatarMoeda(solicitacao.pedido!.valorTotal)}' : ''}',
                              style: const TextStyle(color: AppColors.ink),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Solicitado em ${formatarDataHora(solicitacao.criadoEm)}',
                              style: const TextStyle(fontSize: 11, color: AppColors.muted),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: processando
                                        ? null
                                        : () => _decidir(solicitacao.id, aprovar: false),
                                    child: const Text('Rejeitar'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: processando
                                        ? null
                                        : () => _decidir(solicitacao.id, aprovar: true),
                                    child: Text(processando ? 'Enviando...' : 'Aprovar'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
        ),
      ),
    );
  }
}
