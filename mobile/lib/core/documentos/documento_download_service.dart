import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import '../api_client.dart';
import '../models/documento.dart';

// Extensões comuns pros tipos aceitos no upload (ver
// backend/src/documentos/documentos.service.ts TIPOS_MIME_PERMITIDOS) -
// só usado quando o nome do documento não já traz uma extensão própria.
const _extensaoPorMime = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/csv': '.csv',
};

/// Baixa e armazena documentos institucionais localmente (OS-MOBILE-34) -
/// uma vez baixado, reabrir não busca de novo na API (critério de aceite
/// explícito da OS: "cache local pra reabrir sem precisar baixar de novo").
class DocumentoDownloadService {
  DocumentoDownloadService(this._apiClient);

  final ApiClient _apiClient;

  Future<Directory> _diretorio() async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory(path.join(base.path, 'documentos'));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  String _nomeArquivoLocal(DocumentoResumo documento) {
    final extensaoDoNome = path.extension(documento.nome);
    final extensao = extensaoDoNome.isNotEmpty
        ? extensaoDoNome
        : (_extensaoPorMime[documento.tipoMime] ?? '');
    return '${documento.id}$extensao';
  }

  /// Retorna o arquivo já em cache, ou `null` se ainda não foi baixado.
  Future<File?> arquivoEmCache(DocumentoResumo documento) async {
    final dir = await _diretorio();
    final arquivo = File(path.join(dir.path, _nomeArquivoLocal(documento)));
    return await arquivo.exists() ? arquivo : null;
  }

  Future<File> baixar(
    DocumentoResumo documento, {
    void Function(double progresso)? aoProgredir,
  }) async {
    final bytes = await _apiClient.getBytes(
      '/documentos/${documento.id}/download',
      aoProgredir: (recebidos, total) {
        if (total > 0) {
          aoProgredir?.call(recebidos / total);
        }
      },
    );
    final dir = await _diretorio();
    final arquivo = File(path.join(dir.path, _nomeArquivoLocal(documento)));
    await arquivo.writeAsBytes(bytes);
    return arquivo;
  }
}

final documentoDownloadServiceProvider = Provider<DocumentoDownloadService>((ref) {
  return DocumentoDownloadService(ref.watch(apiClientProvider));
});
