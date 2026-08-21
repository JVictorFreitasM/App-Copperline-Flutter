import 'package:flutter/material.dart';

/// Tokens de cor do design system do projeto (ver skill `design-system`) -
/// mesma paleta usada no web (Next.js/Tailwind). Fonte única de cor: nunca
/// usar `Color(0x...)` literal espalhado pelos widgets, sempre via
/// [AppColors]. Paleta fixa, sem alternância claro/escuro (fora de escopo
/// da skill hoje).
class AppColors {
  const AppColors._();

  static const background = Color(0xFFF4F4F2);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF0A0A0A);
  static const muted = Color(0xFF8C8C8C);
  static const primary = Color(0xFF4640DE);
  static const primaryLight = Color(0xFFC7CBFA);
}
