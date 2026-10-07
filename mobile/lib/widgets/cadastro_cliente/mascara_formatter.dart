import 'package:flutter/services.dart';

/// Aplica uma função de máscara a cada digitação e mantém o cursor no fim -
/// suficiente pra documento/CEP, que se digitam sempre em sequência.
class MascaraFormatter extends TextInputFormatter {
  const MascaraFormatter(this.mascara);

  final String Function(String) mascara;

  @override
  TextEditingValue formatEditUpdate(TextEditingValue anterior, TextEditingValue novo) {
    final texto = mascara(novo.text);
    return TextEditingValue(
      text: texto,
      selection: TextSelection.collapsed(offset: texto.length),
    );
  }
}
