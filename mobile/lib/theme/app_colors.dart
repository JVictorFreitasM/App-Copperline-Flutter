import 'package:flutter/material.dart';

/// Tokens de cor do design system do projeto (ver skill `design-system`) -
/// mesma paleta usada no web (Next.js/Tailwind). Fonte única de cor: nunca
/// usar `Color(0x...)` literal espalhado pelos widgets, sempre via
/// [AppColors]. Paleta fixa, sem alternância claro/escuro (fora de escopo
/// da skill hoje).
class AppColors {
  const AppColors._();

  static const background = Color(0xFFF5F6FA);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF12141D);
  static const muted = Color(0xFF8A8FA3);
  static const primary = Color(0xFF4A6CF7);
  static const primaryLight = Color(0xFFE7ECFE);
  static const accentOrange = Color(0xFFFFA53E);
  static const accentOrangeLight = Color(0xFFFFEAD2);
  static const accentRed = Color(0xFFFF6B6B);
  static const accentRedLight = Color(0xFFFFE1E1);
  static const accentGreen = Color(0xFF2ED47A);
  static const accentGreenLight = Color(0xFFD9F7E7);
}
