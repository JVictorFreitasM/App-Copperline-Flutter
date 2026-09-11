import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/push/push_navigation.dart';
import 'core/server_config.dart';
import 'screens/auth_gate.dart';
import 'theme/app_theme.dart';

// initializeDateFormatting é exigido pelo pacote intl antes de qualquer
// DateFormat com locale explícito (ver core/formatacao.dart) - sem isso,
// formatarData lança LocaleDataException na primeira tela de negócio.
//
// Firebase.initializeApp lê android/app/google-services.json em runtime
// (via plugin com.google.gms.google-services aplicado no build.gradle.kts,
// OS-MOBILE-16) - sem esse arquivo, essa chamada lança na inicialização;
// não há fallback "sem Firebase" aqui porque o app inteiro depende dele
// pra funcionar (registro de token de push, ver push_service.dart).
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('pt_BR');
  await Firebase.initializeApp();
  // Resolvido UMA vez aqui (nao FutureProvider) - server_config.dart e'
  // consultado em toda chamada de API (apiClientProvider), um carregamento
  // assincrono espalharia AsyncValue por uma arvore de providers hoje
  // sincrona.
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [
        serverConfigServiceProvider.overrideWithValue(ServerConfigService(prefs)),
      ],
      child: const CopperlineApp(),
    ),
  );
}

class CopperlineApp extends StatelessWidget {
  const CopperlineApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Copperline',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const AuthGate(),
    );
  }
}
