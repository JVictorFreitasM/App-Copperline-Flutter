import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:copperline_mobile/core/atualizacao/atualizacao_app.dart';
import 'package:copperline_mobile/core/atualizacao/notas_versao.dart';
import 'package:copperline_mobile/core/providers/atualizacao_provider.dart';
import 'package:copperline_mobile/screens/sobre_app_screen.dart';
import 'package:copperline_mobile/widgets/atualizacao_gate.dart';

final _apk = utf8.encode('apk');

Map<String, dynamic> _publicada({int versionCode = 7, String notas = 'Cadastro de cliente e correções'}) => {
  'versionCode': versionCode,
  'versionName': '1.2.0',
  'sha256': sha256.convert(_apk).toString(),
  'tamanhoBytes': _apk.length,
  'notas': notas,
};

AtualizacaoAppService _servico({
  int instalado = 7,
  Map<String, dynamic>? publicada,
  List<String>? abertos,
}) => AtualizacaoAppService(
  buscarVersao: (_) async => publicada,
  baixar: (destino, aoProgredir) async {
    await File(destino).writeAsBytes(_apk);
    aoProgredir(_apk.length, _apk.length);
  },
  abrirInstalador: (caminho) async => abertos?.add(caminho),
  versaoInstalada: () async => instalado,
  pastaDeDownload: () async => Directory.systemTemp.createTempSync('notas-test-'),
  notasStore: NotasVersaoStore(),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('NotasVersaoStore', () {
    test('guarda e lê as notas; valor corrompido vira null', () async {
      final store = NotasVersaoStore();
      expect(await store.ler(), isNull);

      await store.salvar(const NotasVersao(versionCode: 7, versionName: '1.2.0', notas: 'Novidades'));
      final lida = await store.ler();
      expect((lida!.versionCode, lida.versionName, lida.notas), (7, '1.2.0', 'Novidades'));

      SharedPreferences.setMockInitialValues({'atualizacao.notas_da_versao': '{ isso nao e json'});
      expect(await NotasVersaoStore().ler(), isNull);
    });

    test('lembra até qual versão as novidades já foram vistas', () async {
      final store = NotasVersaoStore();
      expect(await store.versaoJaVista(), 0);

      await store.marcarComoVista(7);

      expect(await store.versaoJaVista(), 7);
    });
  });

  group('novidades depois de atualizar', () {
    test('ao instalar a atualização as notas ficam guardadas no aparelho', () async {
      final abertos = <String>[];
      final servico = _servico(instalado: 5, publicada: _publicada(versionCode: 7), abertos: abertos);
      final atualizacao = (await servico.verificar())!;

      await servico.baixarEInstalar(atualizacao, (_) {});

      expect(abertos, hasLength(1));
      final guardada = await NotasVersaoStore().ler();
      expect(guardada?.versionCode, 7);
      expect(guardada?.notas, 'Cadastro de cliente e correções');
    });

    test('na primeira abertura da versão nova mostra as novidades, e só uma vez', () async {
      await NotasVersaoStore().salvar(const NotasVersao(versionCode: 7, versionName: '1.2.0', notas: 'Novidades'));
      final servico = _servico(instalado: 7);

      final primeira = await servico.novidadesParaMostrar();
      expect(primeira?.notas, 'Novidades');

      await servico.marcarNovidadesVistas(7);
      expect(await servico.novidadesParaMostrar(), isNull);
    });

    test('notas de OUTRA versão (instalação cancelada) nunca aparecem', () async {
      await NotasVersaoStore().salvar(const NotasVersao(versionCode: 8, versionName: '1.3.0', notas: 'Da 8'));

      expect(await _servico(instalado: 7).novidadesParaMostrar(), isNull);
    });

    test('notas vazias não abrem aviso nenhum', () async {
      await NotasVersaoStore().salvar(const NotasVersao(versionCode: 7, versionName: '1.2.0', notas: '   '));

      expect(await _servico(instalado: 7).novidadesParaMostrar(), isNull);
    });
  });

  group('notas da versão instalada (tela Sobre)', () {
    test('usa as guardadas na atualização', () async {
      await NotasVersaoStore().salvar(const NotasVersao(versionCode: 7, versionName: '1.2.0', notas: 'Guardadas'));

      expect((await _servico(instalado: 7).notasDaVersaoInstalada())?.notas, 'Guardadas');
    });

    test('app instalado direto do APK: pega as do servidor se a publicada for a instalada', () async {
      final servico = _servico(instalado: 7, publicada: _publicada(versionCode: 7, notas: 'Do servidor'));

      expect((await servico.notasDaVersaoInstalada())?.notas, 'Do servidor');
    });

    test('publicada diferente da instalada (ou sem rede): sem notas, sem erro', () async {
      expect(await _servico(instalado: 7, publicada: _publicada(versionCode: 9)).notasDaVersaoInstalada(), isNull);
      expect(await _servico(instalado: 7).notasDaVersaoInstalada(), isNull);
    });
  });

  group('telas', () {
    Widget app(AtualizacaoAppService servico, {Widget? home}) => ProviderScope(
      overrides: [
        atualizacaoAppServiceProvider.overrideWithValue(servico),
        atualizacaoAppProvider.overrideWith((ref) async => null),
        infoDoAppProvider.overrideWith(
          (ref) async => PackageInfo(
            appName: 'Copperline',
            packageName: 'br.com.copperline.copperline_mobile',
            version: '1.2.0',
            buildNumber: '7',
          ),
        ),
      ],
      child: MaterialApp(
        home: home ?? const AtualizacaoGate(child: Scaffold(body: Text('APP NORMAL'))),
      ),
    );

    testWidgets('aviso "Novidades da versão" aparece na primeira abertura e não volta', (tester) async {
      await NotasVersaoStore().salvar(const NotasVersao(versionCode: 7, versionName: '1.2.0', notas: 'Tela de cadastro de cliente'));
      final servico = _servico(instalado: 7);

      await tester.pumpWidget(app(servico));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
      await tester.pumpAndSettle();

      expect(find.text('Novidades da versão 1.2.0'), findsOneWidget);
      expect(find.text('Tela de cadastro de cliente'), findsOneWidget);

      await tester.tap(find.text('Entendi'));
      await tester.pumpAndSettle();
      expect(find.text('APP NORMAL'), findsOneWidget);

      // Abre o app de novo: não repete.
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(app(servico));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
      await tester.pumpAndSettle();
      expect(find.text('Novidades da versão 1.2.0'), findsNothing);
    });

    testWidgets('sem notas guardadas o app abre direto, sem aviso', (tester) async {
      await tester.pumpWidget(app(_servico(instalado: 7)));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('APP NORMAL'), findsOneWidget);
    });

    testWidgets('Sobre o app mostra a versão instalada e as notas dela', (tester) async {
      await NotasVersaoStore().salvar(const NotasVersao(versionCode: 7, versionName: '1.2.0', notas: 'Atualização automática do app'));

      await tester.pumpWidget(app(_servico(instalado: 7), home: const SobreAppScreen()));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
      await tester.pumpAndSettle();

      expect(find.text('Sobre o app'), findsOneWidget);
      expect(find.text('Versão 1.2.0 (build 7)'), findsOneWidget);
      expect(find.text('Novidades desta versão'), findsOneWidget);
      expect(find.text('Atualização automática do app'), findsOneWidget);
    });

    testWidgets('Sobre o app sem notas avisa e "Verificar atualização" confirma que está atualizado', (tester) async {
      await tester.pumpWidget(app(_servico(instalado: 7), home: const SobreAppScreen()));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
      await tester.pumpAndSettle();
      expect(find.text('Sem notas para esta versão.'), findsOneWidget);

      await tester.tap(find.text('Verificar atualização'));
      await tester.pumpAndSettle();

      expect(find.text('Você já está na versão mais recente.'), findsOneWidget);
    });
  });
}
