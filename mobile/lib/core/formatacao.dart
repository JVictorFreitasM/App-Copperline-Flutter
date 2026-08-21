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
