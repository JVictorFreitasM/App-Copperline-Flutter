import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import '../../core/documentos/documento_download_service.dart';
import '../../core/formatacao.dart';
import '../../core/models/documento.dart';
import '../../core/providers/documentos_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/listagem_feedback.dart';
import '../../widgets/pagination_bar.dart';

/// Aba "Documentos" (OS-MOBILE-34) - lista documentos institucionais
/// (tabelas, catálogos, políticas comerciais) disponibilizados via
/// OS-BACKEND-41/OS-WEB-38, com download com indicador de progresso e
/// cache local (reabrir não baixa de novo, ver DocumentoDownloadService).
class DocumentosScreen extends ConsumerStatefulWidget {
  const DocumentosScreen({super.key});

  @override
  ConsumerState<DocumentosScreen> createState() => _DocumentosScreenState();
}

class _DocumentosScreenState extends ConsumerState<DocumentosScreen> {
  int _pagina = 1;

  @override
  Widget build(BuildContext context) {
    final resultadoAsync = ref.watch(documentosProvider((pagina: _pagina, categoria: null)));

    return Scaffold(
      appBar: AppBar(title: const Text('Documentos')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const Text(
            'Tabelas, catálogos e políticas comerciais disponibilizados pela empresa.',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 16),
          resultadoAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            ),
            error: (erro, _) =>
                ErroConexao(mensagem: '$erro', aoTentarNovamente: () => setState(() {})),
            data: (resultado) => resultado.data.isEmpty
                ? const EstadoVazio(mensagem: 'Nenhum documento disponível ainda.')
                : Column(
                    children: [
                      for (final documento in resultado.data) ...[
                        _LinhaDocumento(documento: documento),
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
      ),
    );
  }
}

class _LinhaDocumento extends ConsumerStatefulWidget {
  const _LinhaDocumento({required this.documento});

  final DocumentoResumo documento;

  @override
  ConsumerState<_LinhaDocumento> createState() => _LinhaDocumentoState();
}

enum _EstadoDownload { verificando, disponivel, baixando, emCache, erro }

class _LinhaDocumentoState extends ConsumerState<_LinhaDocumento> {
  _EstadoDownload _estado = _EstadoDownload.verificando;
  double _progresso = 0;

  @override
  void initState() {
    super.initState();
    _verificarCache();
  }

  Future<void> _verificarCache() async {
    final servico = ref.read(documentoDownloadServiceProvider);
    final arquivo = await servico.arquivoEmCache(widget.documento);
    if (!mounted) return;
    setState(() => _estado = arquivo != null ? _EstadoDownload.emCache : _EstadoDownload.disponivel);
  }

  Future<void> _abrir() async {
    final servico = ref.read(documentoDownloadServiceProvider);
    var arquivo = await servico.arquivoEmCache(widget.documento);

    if (arquivo == null) {
      setState(() {
        _estado = _EstadoDownload.baixando;
        _progresso = 0;
      });
      try {
        arquivo = await servico.baixar(
          widget.documento,
          aoProgredir: (p) {
            if (mounted) setState(() => _progresso = p);
          },
        );
      } catch (erro) {
        if (!mounted) return;
        setState(() => _estado = _EstadoDownload.erro);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Falha ao baixar documento: $erro')),
        );
        return;
      }
    }

    if (!mounted) return;
    setState(() => _estado = _EstadoDownload.emCache);
    await OpenFilex.open(arquivo.path);
  }

  @override
  Widget build(BuildContext context) {
    final documento = widget.documento;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: _estado == _EstadoDownload.baixando ? null : _abrir,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8EDF1),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.description_outlined, size: 17, color: AppColors.navy),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      documento.nome,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${documento.categoria} · ${formatarTamanhoArquivo(documento.tamanhoBytes)} · '
                      '${formatarData(documento.criadoEm.toIso8601String())}',
                      style: const TextStyle(fontSize: 11, color: AppColors.muted),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _IconeEstado(estado: _estado, progresso: _progresso),
            ],
          ),
        ),
      ),
    );
  }
}

class _IconeEstado extends StatelessWidget {
  const _IconeEstado({required this.estado, required this.progresso});

  final _EstadoDownload estado;
  final double progresso;

  @override
  Widget build(BuildContext context) {
    switch (estado) {
      case _EstadoDownload.verificando:
        return const SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.muted),
        );
      case _EstadoDownload.baixando:
        return SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            value: progresso > 0 ? progresso : null,
            color: AppColors.primary,
          ),
        );
      case _EstadoDownload.emCache:
        return const Icon(Icons.open_in_new, size: 18, color: AppColors.primary);
      case _EstadoDownload.disponivel:
        return const Icon(Icons.download_outlined, size: 18, color: AppColors.muted);
      case _EstadoDownload.erro:
        return const Icon(Icons.error_outline, size: 18, color: AppColors.red);
    }
  }
}
