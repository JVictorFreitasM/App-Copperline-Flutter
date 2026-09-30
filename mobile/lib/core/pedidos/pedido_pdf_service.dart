import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import '../api_client.dart';

/// Baixa o PDF de impressão do pedido (`GET /pedidos/:id/pdf`, pedido do
/// usuário 2026-09-28 - botão "Exportar PDF" na aba HISTÓRICO do web) pra
/// abrir com `OpenFilex.open` - mesmo padrão de NotaFiscalPdfService
/// (core/notas_fiscais/nota_fiscal_pdf_service.dart), sem cache permanente
/// (o pedido pode mudar de situação/itens entre uma exportação e outra).
class PedidoPdfService {
  PedidoPdfService(this._apiClient);

  final ApiClient _apiClient;

  Future<File> baixar(String pedidoId) async {
    final bytes = await _apiClient.getBytes('/pedidos/${Uri.encodeComponent(pedidoId)}/pdf');
    final dir = await getTemporaryDirectory();
    final arquivo = File(path.join(dir.path, 'pedido-$pedidoId.pdf'));
    await arquivo.writeAsBytes(bytes);
    return arquivo;
  }
}

final pedidoPdfServiceProvider = Provider<PedidoPdfService>((ref) {
  return PedidoPdfService(ref.watch(apiClientProvider));
});
