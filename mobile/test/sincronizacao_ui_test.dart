import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:copperline_mobile/core/local_db/acao_pendente.dart';
import 'package:copperline_mobile/core/models/pedido.dart';
import 'package:copperline_mobile/core/providers/pedidos_provider.dart';
import 'package:copperline_mobile/screens/pedido_detalhe_screen.dart';
import 'package:copperline_mobile/core/providers/offline_provider.dart';
import 'package:copperline_mobile/core/providers/sincronizacao_provider.dart';
import 'package:copperline_mobile/screens/sincronizacao_screen.dart';
import 'package:copperline_mobile/widgets/lista_atualizavel.dart';

// Notifier de mentira: sem Connectivity/WidgetsBinding/banco - só devolve um
// estado fixo e conta quantas vezes "Sincronizar agora" foi acionado.
class _SincronizacaoFalsa extends SincronizacaoNotifier {
  _SincronizacaoFalsa(this._estado);

  final SincronizacaoEstado _estado;
  int chamadas = 0;

  @override
  SincronizacaoEstado build() => _estado;

  @override
  Future<void> sincronizar() async {
    chamadas++;
  }
}

Widget _app(_SincronizacaoFalsa falsa, {List<AcaoPendente> pendentes = const []}) {
  return ProviderScope(
    overrides: [
      sincronizacaoProvider.overrideWith(() => falsa),
      listaAcoesPendentesProvider.overrideWith((ref) async => pendentes),
    ],
    child: const MaterialApp(home: SincronizacaoScreen()),
  );
}

void main() {
  // O app inicializa o locale no main(); no teste é preciso fazer aqui.
  setUpAll(() => initializeDateFormatting('pt_BR'));
  mainOverflow();

  testWidgets('tela de sincronização mostra o que está salvo offline e o botão', (tester) async {
    final falsa = _SincronizacaoFalsa(
      SincronizacaoEstado(
        ultimaSincronizacao: DateTime(2026, 10, 2, 14, 30),
        dados: const ResumoDadosLocais(clientes: 166, produtos: 1533, tabelas: 20, precos: 11820),
        pendentes: 0,
      ),
    );

    await tester.pumpWidget(_app(falsa));
    await tester.pumpAndSettle();

    expect(find.text('Sincronizado'), findsOneWidget);
    expect(find.text('166'), findsOneWidget);
    expect(find.text('1533'), findsOneWidget);
    expect(find.text('11820'), findsOneWidget);
    expect(find.textContaining('Nada pendente'), findsOneWidget);

    await tester.tap(find.text('Sincronizar agora'));
    expect(falsa.chamadas, 1);
  });

  testWidgets('mostra o erro (sem conexão) e o envio pendente com o motivo da falha', (tester) async {
    final falsa = _SincronizacaoFalsa(
      const SincronizacaoEstado(
        erro: 'Sem conexão - usando os dados salvos neste aparelho.',
        pendentes: 1,
      ),
    );

    await tester.pumpWidget(
      _app(
        falsa,
        pendentes: [
          AcaoPendente(
            idLocal: 'a1',
            tipo: TipoAcaoFila.criarPedido,
            timestamp: '2026-10-02T14:00:00.000Z',
            payload: const {},
            status: StatusAcaoPendente.erro,
            erro: 'Produto repetido',
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Não sincronizou agora'), findsOneWidget);
    expect(find.textContaining('Sem conexão'), findsOneWidget);
    expect(find.text('Pedido'), findsOneWidget);
    expect(find.text('Produto repetido'), findsOneWidget);
  });

  testWidgets('ListaAtualizavel: puxar de cima pra baixo chama aoAtualizar (mesmo com lista curta)', (
    tester,
  ) async {
    var atualizacoes = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ListaAtualizavel(
            aoAtualizar: () async => atualizacoes++,
            children: const [Text('só um item')],
          ),
        ),
      ),
    );

    await tester.fling(find.text('só um item'), const Offset(0, 400), 1000);
    await tester.pumpAndSettle();

    expect(atualizacoes, 1);
  });
}

// Bug do widget "aguardando decisão": a Row (texto + 2 botões) estourava a
// largura do card em tela estreita (RIGHT OVERFLOWED). Reproduz com 320px.
PedidoDetalhe _pedidoPendente() => PedidoDetalhe.fromJson({
  'id': 'p1',
  'numero': null,
  'situacao': null,
  'dataHoraUltimaAlteracao': null,
  'valorTotal': '79799.39',
  'cliente': {'id': 'c1', 'razaoSocial': 'SWAN ELETRICIDADE LTDA'},
  'statusAprovacaoBucket': 'AGUARDANDO_APROVACAO',
  'pesoLiquidoTotalKg': null,
  'pesoBrutoTotalKg': null,
  'observacoes': null,
  'notasFiscais': <Map<String, dynamic>>[],
  'itens': [
    {
      'id': 'i1',
      'numero': 1,
      'quantidadeVenda': '1',
      'valorUnitario': '79799.39',
      'valorTotal': '79799.39',
      'situacao': null,
      'produto': {'id': 'x', 'nome': 'CABO DE COBRE NU MOLE 95,0MM', 'codigo': '16032'},
      'observacoes': null,
      'percentualDesconto': '30.00',
      'statusAprovacao': 'PENDENTE',
      'decididoEm': null,
    },
  ],
  'solicitacaoDesconto': {
    'id': 's1',
    'status': 'PENDENTE',
    'percentualSolicitado': 30,
    'papelExigido': 'SUPERVISOR',
    'aprovadorEsperadoNome': 'ABNESIO',
    'podeDecidir': true,
  },
});

void mainOverflow() {
  testWidgets('item "aguardando decisão" não estoura a largura em tela estreita', (tester) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [pedidoDetalheProvider('p1').overrideWith((ref) async => _pedidoPendente())],
        child: const MaterialApp(home: PedidoDetalheScreen(id: 'p1')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('aguardando decisão'), findsOneWidget);
    expect(find.byTooltip('Aceitar desconto'), findsOneWidget);
    final ex = tester.takeException();
    if (ex is FlutterError) { debugPrint(ex.toStringDeep()); }
    expect(ex, isNull);
  });
}
