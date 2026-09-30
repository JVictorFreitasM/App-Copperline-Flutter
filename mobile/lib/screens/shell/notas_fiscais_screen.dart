import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import '../../core/api_exception.dart';
import '../../core/formatacao.dart';
import '../../core/models/nota_fiscal.dart';
import '../../core/notas_fiscais/nota_fiscal_pdf_service.dart';
import '../../core/providers/notas_fiscais_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/app_card.dart';
import '../../widgets/listagem_feedback.dart';
import '../../widgets/pagination_bar.dart';

/// Tela "Notas fiscais" (equivalente à OS-WEB-17, `frontend/src/app/
/// notas-fiscais/page.tsx`) - só lista+paginação, sem filtro nem tela de
/// detalhe (mesmo escopo do web). Cada linha abre o PDF da NF-e quando
/// disponível (mesma lógica de `LinkPdfNotaFiscal` no web, aqui via
/// download+`OpenFilex.open`, ver `pedido_detalhe_screen.dart` pro mesmo
/// padrão usado na seção embutida do pedido).
class NotasFiscaisScreen extends ConsumerStatefulWidget {
  const NotasFiscaisScreen({super.key});

  @override
  ConsumerState<NotasFiscaisScreen> createState() => _NotasFiscaisScreenState();
}

class _NotasFiscaisScreenState extends ConsumerState<NotasFiscaisScreen> {
  int _pagina = 1;

  @override
  Widget build(BuildContext context) {
    final listaAsync = ref.watch(notasFiscaisProvider(_pagina));

    return Scaffold(
      appBar: AppBar(title: const Text('Notas fiscais')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          listaAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            ),
            error: (erro, _) =>
                ErroConexao(mensagem: '$erro', aoTentarNovamente: () => setState(() {})),
            data: (lista) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (lista.aviso.isNotEmpty) ...[
                  AppCard(
                    child: Text(lista.aviso, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  ),
                  const SizedBox(height: 16),
                ],
                if (lista.resultado.data.isEmpty)
                  const EstadoVazio(mensagem: 'Nenhuma nota fiscal encontrada.')
                else ...[
                  for (final nota in lista.resultado.data) ...[
                    _LinhaNotaFiscal(nota: nota),
                    const SizedBox(height: 8),
                  ],
                  const SizedBox(height: 8),
                  PaginationBar(
                    pagina: lista.resultado.page,
                    totalPaginas: lista.resultado.totalPages,
                    aoMudarPagina: (p) => setState(() => _pagina = p),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LinhaNotaFiscal extends ConsumerStatefulWidget {
  const _LinhaNotaFiscal({required this.nota});

  final NotaFiscal nota;

  @override
  ConsumerState<_LinhaNotaFiscal> createState() => _LinhaNotaFiscalState();
}

class _LinhaNotaFiscalState extends ConsumerState<_LinhaNotaFiscal> {
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

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: temChave && !_abrindo ? _abrirPdf : null,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'NF-e ${nota.numero ?? "—"}${nota.serie != null ? " · Série ${nota.serie}" : ""}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${nota.clienteResumo} · ${rotuloTipoNotaFiscal(nota.tipo)} · ${formatarData(nota.dataEmissao)}',
                      style: const TextStyle(fontSize: 11, color: AppColors.muted),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatarMoeda(nota.valorTotalNotaFiscal),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
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
              else
                Icon(
                  temChave ? Icons.picture_as_pdf_outlined : Icons.block,
                  size: 18,
                  color: temChave ? AppColors.primary : AppColors.muted,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
