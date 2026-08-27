import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:copperline_mobile/core/auth/auth_notifier.dart';
import 'package:copperline_mobile/core/auth/idp_user.dart';
import 'package:copperline_mobile/core/health_provider.dart';
import 'package:copperline_mobile/core/models/dashboard.dart';
import 'package:copperline_mobile/core/providers/dashboard_provider.dart';
import 'package:copperline_mobile/screens/home_screen.dart';
import 'package:copperline_mobile/theme/app_theme.dart';

// Override do healthProvider, authProvider e (desde a OS-MOBILE-14, home
// virou resumo do dia) dos providers de dashboard - nao do
// apiClientProvider/sessionStorageProvider - evita depender de rede real/
// API_BASE_URL e de flutter_secure_storage (usa platform channel,
// indisponivel em teste de widget sem mock) - mesmo espirito de nao fazer
// chamada real em teste automatizado (ver skill flutter-widget, tratar os
// 3 estados de AsyncValue - aqui testamos o estado "data").
const _resumoFake = ResumoDashboard(
  clientesAtivos: 10,
  produtosAtivos: 5,
  pedidosEmAberto: 2,
  valorFaturadoRecente: '1000',
  periodoValorFaturadoDias: 30,
  pedidosRecentes: [],
);
const _estoqueCriticoFake = EstoqueCriticoDashboard(limiar: 10, produtos: []);
const _usuarioFake = IdpUser(
  sub: 'sub-1',
  email: 'teste@copperline.com.br',
  name: 'Usuária de Teste',
  role: null,
  system: 'web',
);

void main() {
  testWidgets('mostra o status da API quando o health check responde ok', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        // Riverpod 3 tenta de novo automaticamente (com delay) quando um
        // provider assincrono lanca (ver ProviderContainer.defaultRetry) -
        // sem desligar isso aqui, o teste fica dependente de tempo real
        // (pumpAndSettle nao espera por Timer solto, so por frame
        // agendado - pode "assentar" achando que terminou enquanto um
        // retry ainda esta pendente). Desligado nos testes pra falha
        // propagar pra AsyncError imediatamente, sem race.
        retry: (_, _) => null,
        overrides: [
          authProvider.overrideWith(
            () => _AuthNotifierFake(const AuthState(usuario: _usuarioFake)),
          ),
          healthProvider.overrideWith(
            () => _HealthNotifierFake(
              HealthStatus(status: 'ok', details: const {}),
            ),
          ),
          resumoDashboardProvider.overrideWith((ref) async => _resumoFake),
          estoqueCriticoDashboardProvider.overrideWith((ref) async => _estoqueCriticoFake),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const HomeScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('API: ok'), findsOneWidget);
    expect(find.text('Olá, Usuária de Teste'), findsOneWidget);
  });

  testWidgets('mostra erro com botao de tentar novamente quando a API falha', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        // Riverpod 3 tenta de novo automaticamente (com delay) quando um
        // provider assincrono lanca (ver ProviderContainer.defaultRetry) -
        // sem desligar isso aqui, o teste fica dependente de tempo real
        // (pumpAndSettle nao espera por Timer solto, so por frame
        // agendado - pode "assentar" achando que terminou enquanto um
        // retry ainda esta pendente). Desligado nos testes pra falha
        // propagar pra AsyncError imediatamente, sem race.
        retry: (_, _) => null,
        overrides: [
          authProvider.overrideWith(
            () => _AuthNotifierFake(const AuthState(usuario: _usuarioFake)),
          ),
          healthProvider.overrideWith(() => _HealthNotifierFakeErro()),
          resumoDashboardProvider.overrideWith((ref) async => _resumoFake),
          estoqueCriticoDashboardProvider.overrideWith((ref) async => _estoqueCriticoFake),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const HomeScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Falha ao conectar com a API'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Tentar novamente'), findsOneWidget);
  });
}

class _AuthNotifierFake extends AuthNotifier {
  _AuthNotifierFake(this._estado);

  final AuthState _estado;

  @override
  Future<AuthState> build() async => _estado;
}

class _HealthNotifierFake extends HealthNotifier {
  _HealthNotifierFake(this._status);

  final HealthStatus _status;

  @override
  Future<HealthStatus> build() async => _status;
}

class _HealthNotifierFakeErro extends HealthNotifier {
  @override
  Future<HealthStatus> build() async {
    throw Exception('Falha simulada de rede');
  }
}
