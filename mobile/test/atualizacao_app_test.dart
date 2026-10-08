import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:copperline_mobile/core/api_exception.dart';
import 'package:copperline_mobile/core/atualizacao/atualizacao_app.dart';
import 'package:copperline_mobile/core/atualizacao/notas_versao.dart';
import 'package:copperline_mobile/core/providers/atualizacao_provider.dart';
import 'package:copperline_mobile/widgets/atualizacao_gate.dart';

final _conteudoApk = utf8.encode('conteudo-do-apk');
final _shaDoApk = sha256.convert(_conteudoApk).toString();

Map<String, dynamic> _versaoPublicada({int versionCode = 7, String? sha}) => {
  'versionCode': versionCode,
  'versionName': '1.2.0',
  'sha256': sha ?? _shaDoApk,
  'tamanhoBytes': _conteudoApk.length,
  'notas': 'Cadastro de cliente e correções',
  'publicadoEm': '2026-10-07T12:00:00.000Z',
};

// Service com as pontas de plataforma trocadas por fakes: sem rede, sem celular.
class _Montagem {
  _Montagem({
    this.publicada,
    this.instalado = 5,
    this.falharBusca = false,
    this.conteudoBaixado,
  });

  Map<String, dynamic>? publicada;
  int instalado;
  bool falharBusca;
  List<int>? conteudoBaixado;

  final apksAbertos = <String>[];
  final versoesConsultadas = <int>[];
  final pasta = Directory.systemTemp.createTempSync('atualizacao-test-');

  AtualizacaoAppService get service => AtualizacaoAppService(
    buscarVersao: (instalada) async {
      versoesConsultadas.add(instalada);
      if (falharBusca) throw ApiException('sem rede');
      return publicada;
    },
    baixar: (destino, aoProgredir) async {
      final bytes = conteudoBaixado ?? _conteudoApk;
      await File(destino).writeAsBytes(bytes);
      aoProgredir(5, bytes.length);
      aoProgredir(bytes.length, bytes.length);
    },
    abrirInstalador: (caminho) async => apksAbertos.add(caminho),
    versaoInstalada: () async => instalado,
    pastaDeDownload: () async => pasta,
    notasStore: NotasVersaoStore(),
  );
}

void main() {
  // O serviço guarda as notas da versão em SharedPreferences.
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('precisaAtualizar', () {
    test('só quando o publicado é MAIOR que o instalado', () {
      expect(precisaAtualizar(instalado: 5, publicado: 6), isTrue);
      expect(precisaAtualizar(instalado: 5, publicado: 5), isFalse);
      // Build local mais novo que o publicado nunca é "rebaixado".
      expect(precisaAtualizar(instalado: 9, publicado: 5), isFalse);
    });
  });

  group('AtualizacaoAppService.verificar', () {
    test('versão publicada mais nova que a instalada: devolve a atualização', () async {
      final m = _Montagem(publicada: _versaoPublicada(versionCode: 7), instalado: 5);

      final atualizacao = await m.service.verificar();

      expect(atualizacao?.versionCode, 7);
      expect(atualizacao?.versionName, '1.2.0');
      expect(atualizacao?.notas, 'Cadastro de cliente e correções');
    });

    test('mesma versão ou mais velha: nada a fazer', () async {
      expect(await _Montagem(publicada: _versaoPublicada(versionCode: 5), instalado: 5).service.verificar(), isNull);
      expect(await _Montagem(publicada: _versaoPublicada(versionCode: 4), instalado: 5).service.verificar(), isNull);
    });

    test('nada publicado (404): nada a fazer', () async {
      expect(await _Montagem(publicada: null).service.verificar(), isNull);
    });

    test('NUNCA bloqueia por não conseguir conferir: sem rede, resposta ruim ou erro vira null', () async {
      expect(await _Montagem(falharBusca: true).service.verificar(), isNull);
      expect(await _Montagem(publicada: {'versionCode': 'sete'}).service.verificar(), isNull);
      expect(await _Montagem(publicada: {}).service.verificar(), isNull);
    });
  });

  group('AtualizacaoAppService.baixarEInstalar', () {
    test('baixa, confere o SHA-256 e só então abre o instalador, com progresso', () async {
      final m = _Montagem(publicada: _versaoPublicada());
      final atualizacao = (await m.service.verificar())!;
      final progressos = <double>[];

      await m.service.baixarEInstalar(atualizacao, progressos.add);

      expect(progressos, [5 / _conteudoApk.length, 1.0]);
      expect(m.apksAbertos, hasLength(1));
      expect(m.apksAbertos.single, endsWith('copperline-7.apk'));
      expect(File(m.apksAbertos.single).existsSync(), isTrue);
    });

    test('APK corrompido ou trocado (SHA diferente): apaga o arquivo e NÃO abre o instalador', () async {
      final m = _Montagem(publicada: _versaoPublicada(), conteudoBaixado: utf8.encode('outro-conteudo'));
      final atualizacao = (await m.service.verificar())!;

      await expectLater(
        m.service.baixarEInstalar(atualizacao, (_) {}),
        throwsA(isA<ApkCorrompidoException>()),
      );

      expect(m.apksAbertos, isEmpty);
      expect(File('${m.pasta.path}${Platform.pathSeparator}copperline-7.apk').existsSync(), isFalse);
    });

    test('um download anterior incompleto não atrapalha o novo', () async {
      final m = _Montagem(publicada: _versaoPublicada());
      final atualizacao = (await m.service.verificar())!;
      await File('${m.pasta.path}${Platform.pathSeparator}copperline-7.apk').writeAsString('pela-metade');

      await m.service.baixarEInstalar(atualizacao, (_) {});

      expect(m.apksAbertos, hasLength(1));
    });
  });

  group('gate de atualização obrigatória', () {
    Widget app({AtualizacaoApp? atualizacao, AtualizacaoAppService? service}) => ProviderScope(
      overrides: [
        atualizacaoAppProvider.overrideWith((ref) async => atualizacao),
        if (service != null) atualizacaoAppServiceProvider.overrideWithValue(service),
      ],
      child: const MaterialApp(home: AtualizacaoGate(child: Scaffold(body: Text('APP NORMAL')))),
    );

    final nova = AtualizacaoApp.fromJson(_versaoPublicada());

    // O download usa arquivo de verdade (I/O real), que não avança no relógio
    // falso dos testes de widget - espera de verdade e redesenha.
    Future<void> tocarEEsperarDownload(WidgetTester tester) async {
      await tester.tap(find.text('Atualizar agora'));
      // Cada etapa de I/O real (criar pasta, gravar, ler o hash) só continua
      // depois de um pump - alterna espera de verdade e redesenho.
      for (var i = 0; i < 12; i++) {
        await tester.pump();
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
      }
      await tester.pump();
    }

    testWidgets('sem versão nova: mostra o app normalmente', (tester) async {
      await tester.pumpWidget(app());
      await tester.pumpAndSettle();

      expect(find.text('APP NORMAL'), findsOneWidget);
      expect(find.text('Atualização necessária'), findsNothing);
    });

    testWidgets('com versão nova: o app é SUBSTITUÍDO pela tela de atualização (sem como pular)', (tester) async {
      await tester.pumpWidget(app(atualizacao: nova));
      await tester.pumpAndSettle();

      expect(find.text('APP NORMAL'), findsNothing);
      expect(find.text('Atualização necessária'), findsOneWidget);
      expect(find.textContaining('novas funcionalidades e correções de bugs'), findsOneWidget);
      expect(find.text('Cadastro de cliente e correções'), findsOneWidget);
      expect(find.textContaining('1.2.0'), findsOneWidget);
      expect(find.text('Atualizar agora'), findsOneWidget);
      // Sem "agora não"/fechar.
      expect(find.text('Agora não'), findsNothing);
      expect(find.byType(BackButton), findsNothing);
      expect(tester.widget<PopScope>(find.byType(PopScope)).canPop, isFalse);
    });

    testWidgets('Atualizar agora baixa e abre o instalador', (tester) async {
      final m = _Montagem(publicada: _versaoPublicada());
      await tester.pumpWidget(app(atualizacao: nova, service: m.service));
      await tester.pumpAndSettle();

      await tocarEEsperarDownload(tester);

      expect(m.apksAbertos, hasLength(1));
      expect(find.text('Atualizar agora'), findsOneWidget); // volta o botão se o usuário cancelar
    });

    testWidgets('APK corrompido mostra o erro e deixa tentar de novo', (tester) async {
      final m = _Montagem(publicada: _versaoPublicada(), conteudoBaixado: utf8.encode('lixo'));
      await tester.pumpWidget(app(atualizacao: nova, service: m.service));
      await tester.pumpAndSettle();

      await tocarEEsperarDownload(tester);

      expect(find.textContaining('corrompido'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsOneWidget);
      expect(m.apksAbertos, isEmpty);
    });
  });
}
