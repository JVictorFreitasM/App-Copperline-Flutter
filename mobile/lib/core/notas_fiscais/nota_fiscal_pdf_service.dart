import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import '../api_client.dart';
import '../api_exception.dart';

/// Baixa o PDF da NF-e (`GET /notas-fiscais/:id/pdf`) e devolve o arquivo
/// pra abrir com `OpenFilex.open` (mesmo padrão de DocumentoDownloadService,
/// documentos/documento_download_service.dart) - mas SEM cache permanente:
/// diferente de documento institucional, uma nota fiscal pode não ter PDF
/// disponível ainda (chave sincronizada mas arquivo não copiado pro share
/// de rede) e o status muda; melhor sempre buscar de novo, mesma decisão
/// do web (`LinkPdfNotaFiscal`, fetch-blob-then-open a cada clique).
class NotaFiscalPdfService {
  NotaFiscalPdfService(this._apiClient);

  final ApiClient _apiClient;

  /// Lança [ApiException] com `statusCode == 404` quando o PDF ainda não
  /// está disponível (chave não sincronizada ou arquivo não copiado pro
  /// share de rede ainda) - a UI trata isso como "tente mais tarde", não
  /// como erro de conexão genérico.
  Future<File> baixar(String notaFiscalId) async {
    final bytes = await _apiClient.getBytes('/notas-fiscais/${Uri.encodeComponent(notaFiscalId)}/pdf');
    final dir = await getTemporaryDirectory();
    final arquivo = File(path.join(dir.path, 'nfe-$notaFiscalId.pdf'));
    await arquivo.writeAsBytes(bytes);
    return arquivo;
  }
}

final notaFiscalPdfServiceProvider = Provider<NotaFiscalPdfService>((ref) {
  return NotaFiscalPdfService(ref.watch(apiClientProvider));
});
