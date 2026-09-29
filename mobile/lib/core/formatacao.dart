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

// OS-novas-implementacoes.md Bloco 3 - peso total do pedido (Decimal do
// Prisma chega como string, mesmo padrão de formatarMoeda acima).
String formatarPeso(String? valorKg) {
  if (valorKg == null) return '—';
  final numero = double.tryParse(valorKg);
  if (numero == null) return '—';
  return '${NumberFormat.decimalPattern('pt_BR').format(numero)} kg';
}

// Listagem de lotes (estoque_screen.dart) - achado 2026-09-29: quantidade
// vinha crua da API (string tipo "240.8000"), sem NENHUMA formatação -
// pt-BR lê ponto como separador de milhar, então "240.8000" parecia
// "240800,0", 1000x maior que o valor real. Mesmo padrão de
// formatarQuantidadeLote em frontend/src/lib/formatacao.ts (2026-09-28):
// sempre 3 casas decimais, mesmo com zero à direita (0,9 -> "0,900").
String formatarQuantidadeLote(String valor) {
  final numero = double.tryParse(valor);
  if (numero == null) return valor;
  return NumberFormat('#,##0.000', 'pt_BR').format(numero);
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
