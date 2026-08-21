import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/providers/clientes_provider.dart';
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
