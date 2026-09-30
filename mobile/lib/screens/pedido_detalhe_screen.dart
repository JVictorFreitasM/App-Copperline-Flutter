import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import '../core/api_exception.dart';
import '../core/formatacao.dart';
import '../core/models/nota_fiscal.dart';
import '../core/models/pedido.dart';
import '../core/notas_fiscais/nota_fiscal_pdf_service.dart';
import '../core/pedidos/pedido_pdf_service.dart';
import '../core/providers/pedidos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/pedido_stepper.dart';

/// Detalhe do pedido (mobile, equivalente à OS-WEB-15) - mostra o que a
/// listagem não mostra: os itens do pedido.
class PedidoDetalheScreen extends ConsumerWidget {
  const PedidoDetalheScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pedidoAsync = ref.watch(pedidoDetalheProvider(id));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pedido'),
        // Pedido do usuário (2026-09-30) - "Exportar PDF" só existia na
        // web (aba HISTÓRICO). Sem escopo pra pedido inexistente/erro
        // ainda carregando (a tela toda já trata isso no body).
        actions: [if (pedidoAsync.hasValue) _BotaoExportarPdf(pedidoId: id)],
      ),
      body: SafeArea(
        child: pedidoAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 404
                ? EstadoVazio(mensagem: "Pedido '$id' não encontrado.")
                : ErroConexao(mensagem: '$erro'),
          ),
          data: (pedido) {
            final situacaoConfig = configSituacaoPedido(pedido.situacao);
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        pedido.tituloCliente,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                    AppBadge(texto: situacaoConfig.rotulo, enfase: situacaoConfig.enfase),
                  ],
                ),
                Text(
                  'Pedido ${pedido.numero ?? "—"} · '
                  '${formatarData(pedido.dataHoraUltimaAlteracao)}',
                  style: const TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 16),
                AppCard(child: PedidoStepper(situacao: pedido.situacao)),
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Valor total', style: TextStyle(color: AppColors.muted)),
                      Text(
                        formatarMoeda(pedido.valorTotal),
                        style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                // OS-novas-implementacoes.md Bloco 3 - null quando algum item
                // não tem peso cadastrado (ver PedidoDetalhe.pesoLiquidoTotalKg);
                // card some inteiro nesse caso em vez de mostrar "—" enganoso.
                if (pedido.pesoLiquidoTotalKg != null || pedido.pesoBrutoTotalKg != null) ...[
                  const SizedBox(height: 16),
                  AppCard(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Peso líquido', style: TextStyle(color: AppColors.muted)),
                              Text(
                                formatarPeso(pedido.pesoLiquidoTotalKg),
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Peso bruto', style: TextStyle(color: AppColors.muted)),
                              Text(
                                formatarPeso(pedido.pesoBrutoTotalKg),
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                Text('Itens', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                if (pedido.itens.isEmpty)
                  const EstadoVazio(mensagem: 'Nenhum item neste pedido.')
                else
                  for (final PedidoItem item in pedido.itens) ...[
                    AppCard(
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.produto?.nome ?? item.produto?.codigo ?? '—',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Qtde ${item.quantidadeVenda ?? "—"} × '
                                  '${formatarMoeda(item.valorUnitario)}',
                                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                                ),
                                if (item.observacoes != null && item.observacoes!.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    'Obs: ${item.observacoes}',
                                    style: const TextStyle(fontSize: 11, color: AppColors.muted),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Text(
                            formatarMoeda(item.valorTotal),
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                if (pedido.observacoes != null && pedido.observacoes!.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Text('Observações', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  AppCard(child: Text(pedido.observacoes!)),
                ],
                if (pedido.esperaNotaFiscal) ...[
                  const SizedBox(height: 24),
                  Text('Notas fiscais', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  if (pedido.notasFiscais.isEmpty)
                    const EstadoVazio(mensagem: 'Nenhuma nota fiscal vinculada a este pedido ainda.')
                  else
                    for (final nota in pedido.notasFiscais) ...[
                      _LinhaNotaFiscalPedido(nota: nota),
                      const SizedBox(height: 8),
                    ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _BotaoExportarPdf extends ConsumerStatefulWidget {
  const _BotaoExportarPdf({required this.pedidoId});

  final String pedidoId;

  @override
  ConsumerState<_BotaoExportarPdf> createState() => _BotaoExportarPdfState();
}

class _BotaoExportarPdfState extends ConsumerState<_BotaoExportarPdf> {
  bool _exportando = false;

  Future<void> _exportar() async {
    setState(() => _exportando = true);
    try {
      final servico = ref.read(pedidoPdfServiceProvider);
      final arquivo = await servico.baixar(widget.pedidoId);
      if (!mounted) return;
      await OpenFilex.open(arquivo.path);
    } catch (erro) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Falha ao exportar PDF: $erro')));
    } finally {
      if (mounted) setState(() => _exportando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_exportando) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
        ),
      );
    }
    return IconButton(
      onPressed: _exportar,
      icon: const Icon(Icons.picture_as_pdf_outlined, color: AppColors.foreground),
      tooltip: 'Exportar PDF',
    );
  }
}

class _LinhaNotaFiscalPedido extends ConsumerStatefulWidget {
  const _LinhaNotaFiscalPedido({required this.nota});

  final NotaFiscalResumoPedido nota;

  @override
  ConsumerState<_LinhaNotaFiscalPedido> createState() => _LinhaNotaFiscalPedidoState();
}

class _LinhaNotaFiscalPedidoState extends ConsumerState<_LinhaNotaFiscalPedido> {
  bool _abrindo = false;

  Future<void> _abrirPdf() async {
    setState(() => _abrindo = true);
    try {
      final servico = ref.read(notaFiscalPdfServiceProvider);
      final arquivo = await servico.baixar(widget.nota.id);
      if (!mounted) return;
      await OpenFilex.open(arquivo.path);
    } catch (erro) {
      if (!mounted) return;
      final mensagem = erro is ApiException && erro.statusCode == 404
          ? 'PDF ainda não disponível pra esta nota fiscal.'
          : 'Falha ao baixar o PDF: $erro';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensagem)));
    } finally {
      if (mounted) setState(() => _abrindo = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final nota = widget.nota;
    final status = configStatusNfe(nota.statusNfe);
    final temChave = nota.chave != null;

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'NF-e ${nota.numero ?? "—"}${nota.serie != null ? " · Série ${nota.serie}" : ""}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  'Emitida em ${formatarData(nota.dataEmissao)} · '
                  '${formatarMoeda(nota.valorTotalNotaFiscal)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          AppBadge(texto: status.rotulo, enfase: status.enfase),
          const SizedBox(width: 8),
          if (_abrindo)
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            )
          else if (temChave)
            IconButton(
              onPressed: _abrirPdf,
              icon: const Icon(Icons.picture_as_pdf_outlined, color: AppColors.primary),
              tooltip: 'Abrir PDF',
            )
          else
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Text('PDF indisponível', style: TextStyle(fontSize: 11, color: AppColors.muted)),
            ),
        ],
      ),
    );
  }
}
