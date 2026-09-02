import 'package:intl/intl.dart';

/// Mesma formatação do web (`frontend/src/lib/formatacao.ts`) - moeda e
/// data sempre em pt-BR, `null`/valor inválido sempre vira "—" em vez de
/// deixar `NaN`/`Invalid Date` vazar pra tela.
String formatarMoeda(String? valor) {
  if (valor == null) return '—';
  final numero = double.tryParse(valor);
  if (numero == null) return '—';
  return NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$').format(numero);
}

String formatarData(String? valorIso) {
  if (valorIso == null) return '—';
  final data = DateTime.tryParse(valorIso);
  if (data == null) return '—';
  return DateFormat('dd/MM/yyyy', 'pt_BR').format(data.toLocal());
}

String formatarDataHora(String? valorIso) {
  if (valorIso == null) return '—';
  final data = DateTime.tryParse(valorIso);
  if (data == null) return '—';
  return DateFormat('dd/MM/yyyy HH:mm', 'pt_BR').format(data.toLocal());
}

// OS-MOBILE-34 (aba de documentos) - tamanho em bytes vindo da API vira
// KB/MB legível.
String formatarTamanhoArquivo(int bytes) {
  if (bytes < 1024) return '$bytes B';
  final kb = bytes / 1024;
  if (kb < 1024) return '${kb.toStringAsFixed(0)} KB';
  final mb = kb / 1024;
  return '${mb.toStringAsFixed(1)} MB';
}
