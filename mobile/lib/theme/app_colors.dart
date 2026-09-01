import 'package:flutter/material.dart';

/// Tokens de cor do design system do projeto (ver skill `design-system`)
/// - replicados EXATAMENTE do app de referência fornecido pelo usuário
/// (Downloads/aplicativo-comercial-interno/app/globals.css, "Nexo
/// Comercial") - fonte única: nunca usar `Color(0x...)` literal espalhado
/// pelos widgets, sempre via [AppColors].
class AppColors {
  const AppColors._();

  static const background = Color(0xFFEEF1F4);
  static const foreground = Color(0xFF10202B);
  static const ink = foreground; // alias - resto do app já usa "ink"
  static const surface = Color(0xFFFFFFFF);
  static const card = surface;
  static const muted = Color(0xFF63717A);
  static const line = Color(0xFFDBE2E7);
  static const navy = Color(0xFF102B3A);
  static const primary = Color(0xFF1667D9);
  static const primaryLight = Color(0xFFE8F0FD);
  static const green = Color(0xFF18794E);
  static const greenLight = Color(0xFFE3F4EB);
  static const amber = Color(0xFF9A5B00);
  static const amberLight = Color(0xFFFFF1D6);
  static const red = Color(0xFFB42318);
  static const redLight = Color(0xFFFDE9E7);

  // Aliases pra código existente que já usa esses nomes (evita rename em
  // cascata em todo widget já escrito antes desta troca de referência).
  static const accentOrange = amber;
  static const accentOrangeLight = amberLight;
  static const accentRed = red;
  static const accentRedLight = redLight;
  static const accentGreen = green;
  static const accentGreenLight = greenLight;
}
