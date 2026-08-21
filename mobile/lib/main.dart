import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'screens/auth_gate.dart';
import 'theme/app_theme.dart';

// initializeDateFormatting é exigido pelo pacote intl antes de qualquer
// DateFormat com locale explícito (ver core/formatacao.dart) - sem isso,
// formatarData lança LocaleDataException na primeira tela de negócio.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('pt_BR');
  runApp(const ProviderScope(child: CopperlineApp()));
}

class CopperlineApp extends StatelessWidget {
  const CopperlineApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Copperline',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const AuthGate(),
    );
  }
}
