import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Tema fixo (sem alternância claro/escuro) - replica a referência "Nexo
/// Comercial" (Downloads/aplicativo-comercial-interno): cantos moderados
/// (14px em cards, ~9-10px em botões/inputs - NUNCA o raio extremo/pill de
/// uma versão anterior desta skill), botão primário AZUL (não preto),
/// cards brancos com borda sutil `line` (a referência usa borda visível,
/// não só sombra).
class AppTheme {
  const AppTheme._();

  static const double cardRadius = 14;
  static const double controlRadius = 10;

  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      // Referência usa Arial/Helvetica (proprietárias, não embutidas no
      // Flutter) - Inter via google_fonts como substituta visualmente
      // próxima (mesma família geométrica), decisão do usuário
      // (ajustes-layout item 4). fontFamily no nível do ThemeData cobre
      // tanto o textTheme abaixo quanto qualquer TextStyle inline que não
      // declare a própria família (maioria das telas do app).
      fontFamily: GoogleFonts.inter().fontFamily,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        surface: AppColors.surface,
        onSurface: AppColors.foreground,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
          side: const BorderSide(color: AppColors.line),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(controlRadius),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: const BorderSide(color: Color(0xFFA9C6EE)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(controlRadius),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(controlRadius),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(controlRadius),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(controlRadius),
          borderSide: const BorderSide(color: AppColors.primary),
        ),
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 25,
          fontWeight: FontWeight.bold,
          letterSpacing: -0.5,
          color: AppColors.foreground,
        ),
        headlineMedium: TextStyle(
          fontSize: 19,
          fontWeight: FontWeight.bold,
          letterSpacing: -0.3,
          color: AppColors.foreground,
        ),
        titleMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.foreground,
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: AppColors.foreground,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.normal,
          color: AppColors.muted,
        ),
        // Eyebrow (maiúsculo, letterSpacing largo) - piso de leitura maior
        // que o valor 1:1 do CSS de referência (9px), que fica pequeno
        // demais como sp real de dispositivo (ajustes-layout item 4).
        labelSmall: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
          color: AppColors.muted,
        ),
      ),
    );
  }
}
