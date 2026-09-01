import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:copperline_mobile/core/auth/auth_notifier.dart';
import 'package:copperline_mobile/core/auth/idp_user.dart';
import 'package:copperline_mobile/core/models/dashboard.dart';
import 'package:copperline_mobile/core/models/meu_vendedor.dart';
import 'package:copperline_mobile/core/providers/aprovacoes_provider.dart';
import 'package:copperline_mobile/core/providers/dashboard_provider.dart';
import 'package:copperline_mobile/core/providers/visitas_provider.dart';
import 'package:copperline_mobile/screens/home_screen.dart';
import 'package:copperline_mobile/theme/app_theme.dart';

// Override do authProvider e (desde a OS-MOBILE-14, home virou resumo do
// dia) dos providers de dashboard/aprovações/visitas - nao do
// apiClientProvider/sessionStorageProvider - evita depender de rede real/
// API_BASE_URL e de flutter_secure_storage (usa platform channel,
// indisponivel em teste de widget sem mock) - mesmo espirito de nao fazer
// chamada real em teste automatizado (ver skill flutter-widget, tratar os
// 3 estados de AsyncValue - aqui testamos o estado "data"). healthProvider
// não é mais usado por HomeScreen (removido no redesign "Nexo Comercial" -
// ver home_screen.dart) - sem override aqui.
const _resumoFake = ResumoDashboard(
  clientesAtivos: 10,
  produtosAtivos: 5,
  pedidosEmAberto: 2,
  valorFaturadoRecente: '1000',
  periodoValorFaturadoDias: 30,
  pedidosRecentes: [],
);
const _estoqueCriticoFake = EstoqueCriticoDashboard(limiar: 10, produtos: []);
const _meuVendedorFake = MeuVendedor(vendedorId: null, papel: null, podeAprovar: false);
const _usuarioFake = IdpUser(
  sub: 'sub-1',
  email: 'teste@copperline.com.br',
  name: 'Usuária de Teste',
  role: null,
  system: 'web',
);

void main() {
  testWidgets('mostra a saudação e o resumo do dia quando os dados carregam', (
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
          estoqueCriticoDashboardProvider.overrideWith((ref) async => _estoqueCriticoFake),
          meuVendedorProvider.overrideWith((ref) async => _meuVendedorFake),
          minhasVisitasProvider.overrideWith((ref, data) async => const []),
          resumoDashboardProvider.overrideWith((ref) async => _resumoFake),
        ],
        // HomeScreen não tem mais Scaffold próprio (virou aba do AppShell,
        // que já embrulha tudo num Scaffold - ver shell/app_shell.dart) -
        // sem um Material ancestral aqui, InkWell/_CampoBuscaAtalho quebra
        // o build ("No Material widget found").
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(body: HomeScreen()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Saudação varia com o horário real (_saudacao() em home_screen.dart) -
    // busca por conteúdo em vez do texto exato pra não depender da hora em
    // que o teste roda.
    expect(
      find.byWidgetPredicate(
        (w) => w is Text && (w.data ?? '').contains('Usuária') && (w.data ?? '').contains(','),
      ),
      findsOneWidget,
    );
    // "Resumo de hoje" fica abaixo da grade de acesso rápido, fora do
    // viewport padrão de teste - precisa rolar até lá antes de checar
    // (scrollUntilVisible exige finder/scrollable únicos e dá "Too many
    // elements" nesta árvore, por isso o drag manual abaixo).
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    expect(find.textContaining('R\$'), findsWidgets);
  });

  testWidgets('mostra erro com botao de tentar novamente quando o resumo falha', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        retry: (_, _) => null,
        overrides: [
          authProvider.overrideWith(
            () => _AuthNotifierFake(const AuthState(usuario: _usuarioFake)),
          ),
          estoqueCriticoDashboardProvider.overrideWith((ref) async => _estoqueCriticoFake),
          meuVendedorProvider.overrideWith((ref) async => _meuVendedorFake),
          minhasVisitasProvider.overrideWith((ref, data) async => const []),
          resumoDashboardProvider.overrideWith(
            (ref) async => throw Exception('Falha simulada de rede'),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(body: HomeScreen()),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -600));
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
