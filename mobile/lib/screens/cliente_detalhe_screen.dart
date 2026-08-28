import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/models/cliente_resumo_llm.dart';
import '../core/providers/clientes_provider.dart';
import '../core/providers/cliente_resumo_llm_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';

/// Detalhe do cliente (mobile, equivalente à OS-WEB-15) - mostra o que a
/// listagem não mostra: contatos. Só leitura. Sem endereços (mesmo recorte
/// do web: JSONB cru do WK Radar, sem schema estável pra um formulário
/// fixo, ver `core/models/cliente.dart`).
class ClienteDetalheScreen extends ConsumerWidget {
  const ClienteDetalheScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clienteAsync = ref.watch(clienteDetalheProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Cliente')),
      body: SafeArea(
        child: clienteAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 404
                ? EstadoVazio(mensagem: "Cliente '$id' não encontrado.")
                : ErroConexao(mensagem: '$erro'),
          ),
          data: (cliente) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      cliente.titulo,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  BadgeAtivoInativo(inativo: cliente.inativo),
                ],
              ),
              if (cliente.nomeFantasia != null && cliente.nomeFantasia != cliente.razaoSocial)
                Text(cliente.nomeFantasia!, style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 16),
              _CardResumoLlm(clienteId: id),
              const SizedBox(height: 16),
              AppCard(
                child: Text(
                  'CPF/CNPJ: ${cliente.cpfCnpj ?? "—"}',
                  style: const TextStyle(color: AppColors.ink),
                ),
              ),
              const SizedBox(height: 24),
              Text('Contatos', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              if (cliente.contatos.isEmpty)
                const EstadoVazio(mensagem: 'Nenhum contato cadastrado.')
              else
                for (final contato in cliente.contatos) ...[
                  ListItemTile(
                    titulo: contato.nome ?? '—',
                    subtitulo: contato.funcao ?? 'Sem função registrada',
                    valor: contato.email ?? contato.telefoneFormatado,
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

/// Card de resumo de carteira via IA (OS-MOBILE-18) - próprio provider
/// (não o do resto do detalhe do cliente), pra um erro/demora do LLM não
/// travar o resto da tela (que já carregou com sucesso).
class _CardResumoLlm extends ConsumerWidget {
  const _CardResumoLlm({required this.clienteId});

  final String clienteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resumo = ref.watch(clienteResumoLlmProvider(clienteId));

    return resumo.when(
      loading: () => const AppCard(
        child: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            SizedBox(width: 12),
            Text('Gerando resumo com IA...', style: TextStyle(color: AppColors.muted)),
          ],
        ),
      ),
      error: (erro, _) => AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Resumo indisponível',
              style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
            ),
            const SizedBox(height: 4),
            Text('$erro', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(clienteResumoLlmProvider(clienteId)),
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
      data: (dados) => _CardResumoLlmDados(dados: dados),
    );
  }
}

class _CardResumoLlmDados extends StatelessWidget {
  const _CardResumoLlmDados({required this.dados});

  final ClienteResumoLlm dados;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              const Text(
                'Resumo do cliente',
                style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
              ),
              if (dados.dadosInsuficientes) ...[
                const SizedBox(width: 8),
                const AppBadge(texto: 'Dados insuficientes'),
              ],
            ],
          ),
          const SizedBox(height: 10),
          if (dados.pontosDeAtencao.isNotEmpty) ...[
            const Text(
              'Pontos de atenção',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted),
            ),
            const SizedBox(height: 4),
            for (final ponto in dados.pontosDeAtencao)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text('•  $ponto', style: const TextStyle(color: AppColors.ink)),
              ),
            const SizedBox(height: 10),
          ],
          const Text(
            'Sugestão de abordagem',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted),
          ),
          const SizedBox(height: 4),
          Text(dados.sugestaoAbordagem, style: const TextStyle(color: AppColors.ink)),
        ],
      ),
    );
  }
}
