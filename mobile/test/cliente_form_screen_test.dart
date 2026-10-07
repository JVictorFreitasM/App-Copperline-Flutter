import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:copperline_mobile/core/api_client.dart';
import 'package:copperline_mobile/core/models/cadastro_cliente.dart';
import 'package:copperline_mobile/core/models/documento_brasileiro.dart';
import 'package:copperline_mobile/core/providers/cadastro_cliente_provider.dart';
import 'package:copperline_mobile/screens/cliente_form_screen.dart';

// Serviço de mentira: sem rede nem Dio de verdade - devolve o que o teste
// configurar e registra o que a tela pediu.
class _ServicoFalso extends CadastroClienteService {
  _ServicoFalso() : super(ApiClient.paraTeste(Dio()));

  ResultadoDocumento documento = const DocumentoCpfLivre();
  final consultas = <String>[];
  final criacoes = <Map<String, dynamic>>[];

  @override
  Future<ResultadoDocumento> consultarDocumento(String entrada) async {
    consultas.add(entrada);
    return documento;
  }

  @override
  Future<ClienteCriado> criar(Map<String, dynamic> payload) async {
    criacoes.add(payload);
    return const ClienteCriado(id: 'cliente-novo', statusEnvioErp: 'PENDENTE');
  }

  // Edição.
  ClienteEdicao? edicao;
  String situacaoDaEdicao = 'ALTERACAO_PENDENTE';
  final atualizacoes = <Map<String, dynamic>>[];

  @override
  Future<ClienteEdicao> obterParaEdicao(String clienteId) async => edicao!;

  @override
  Future<String> atualizar(String clienteId, Map<String, dynamic> payload) async {
    atualizacoes.add(payload);
    return situacaoDaEdicao;
  }
}

const _enderecoDaReceita = EnderecoSugerido(
  cep: '64076130',
  logradouro: 'AV DEPUTADO PAULO FERRAZ',
  numero: '5250',
  bairro: 'LIVRAMENTO',
  municipio: 'TERESINA',
  uf: 'PI',
  codigoIbge: '2211001',
);

final _cnpjDaReceita = DocumentoCnpj(
  const ConsultaCnpjResultado(
    dados: DadosEmpresa(
      razaoSocial: 'MEGA FIOS LTDA',
      nomeFantasia: 'MEGA',
      email: 'contato@megafios.com.br',
      telefone: '(86) 3218-8383',
    ),
    enderecoSugerido: _enderecoDaReceita,
  ),
);

// Navegação de verdade (Navigator) pra a tela poder devolver o id ao fechar.
Widget _app(_ServicoFalso servico, {void Function(String?)? aoFechar}) {
  return ProviderScope(
    overrides: [cadastroClienteServiceProvider.overrideWithValue(servico)],
    child: MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async {
                final id = await Navigator.of(context).push<String>(
                  MaterialPageRoute(builder: (_) => const ClienteFormScreen()),
                );
                aoFechar?.call(id);
              },
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    ),
  );
}

Future<void> _abrir(WidgetTester tester, Widget app) async {
  tester.view.physicalSize = const Size(900, 3000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(app);
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

Finder _campoDocumento() => find.widgetWithText(TextField, 'CNPJ');

void main() {
  testWidgets('abre o cadastro com contato obrigatório e "Usar o mesmo endereço" marcado', (tester) async {
    await _abrir(tester, _app(_ServicoFalso()));

    expect(find.text('Novo cliente'), findsOneWidget);
    expect(find.text('Obrigatório: adicione pelo menos um contato.'), findsOneWidget);
    expect(find.text('Endereço de Entrega'), findsNothing);
    // Marcado: um seletor só, de cobrança e entrega.
    expect(find.text('Endereço de Cobrança e Entrega'), findsOneWidget);
    final checkbox = tester.widget<CheckboxListTile>(find.byType(CheckboxListTile).first);
    expect(checkbox.value, isTrue);
    // Suframa e Observações saíram do cadastro.
    expect(find.textContaining('Suframa'), findsNothing);
    expect(find.text('Observações'), findsNothing);
  });

  testWidgets('desmarcar "Usar o mesmo endereço" separa cobrança e entrega', (tester) async {
    await _abrir(tester, _app(_ServicoFalso()));

    await tester.tap(find.text('Usar o mesmo endereço'));
    await tester.pumpAndSettle();

    expect(find.text('Endereço de Cobrança'), findsWidgets);
    expect(find.text('Endereço de Entrega'), findsWidgets);
    expect(find.text('Endereço de Cobrança e Entrega'), findsNothing);
  });

  testWidgets('CNPJ com dígito errado é recusado SEM chamar o servidor', (tester) async {
    final servico = _ServicoFalso();
    await _abrir(tester, _app(servico));

    await tester.enterText(_campoDocumento(), '07127994000151');
    await tester.pumpAndSettle();

    expect(find.text('CNPJ inválido.'), findsOneWidget);
    expect(servico.consultas, isEmpty);
  });

  testWidgets('CNPJ completo e válido consulta uma vez e autopreenche o formulário', (tester) async {
    final servico = _ServicoFalso()..documento = _cnpjDaReceita;
    await _abrir(tester, _app(servico));

    await tester.enterText(_campoDocumento(), '07127994000150');
    await tester.pumpAndSettle();

    expect(servico.consultas, ['07127994000150']);
    expect(find.text('Dados da Receita Federal preenchidos.'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'MEGA FIOS LTDA'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'MEGA'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'contato@megafios.com.br'), findsOneWidget);
    // Endereço vindo da Receita já escolhido pra cobrança.
    expect(find.text('AV DEPUTADO PAULO FERRAZ, 5250, LIVRAMENTO'), findsWidgets);
    expect(find.text('(86) 3218-8383'), findsOneWidget);
  });

  testWidgets('autopreencher não sobrescreve o que o usuário já digitou', (tester) async {
    final servico = _ServicoFalso()..documento = _cnpjDaReceita;
    await _abrir(tester, _app(servico));

    await tester.enterText(find.widgetWithText(TextField, 'Razão Social'), 'Nome que eu digitei');
    await tester.enterText(_campoDocumento(), '07127994000150');
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextField, 'Nome que eu digitei'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'MEGA FIOS LTDA'), findsNothing);
  });

  testWidgets('CNPJ já cadastrado mostra o vendedor responsável e bloqueia o Salvar', (tester) async {
    final servico = _ServicoFalso()
      ..documento = const DocumentoJaCadastrado(
        ClienteJaCadastrado(razaoSocial: 'MEGA FIOS LTDA', vendedorResponsavel: 'Joana'),
      );
    await _abrir(tester, _app(servico));

    await tester.enterText(_campoDocumento(), '07127994000150');
    await tester.pumpAndSettle();
    expect(find.text('Já cadastrado (MEGA FIOS LTDA) - vendedor responsável: Joana.'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
    await tester.pumpAndSettle();

    expect(find.text('Este documento já está cadastrado.'), findsOneWidget);
    expect(servico.criacoes, isEmpty);
  });

  testWidgets('não grava sem nenhum contato, mesmo com o resto preenchido', (tester) async {
    final servico = _ServicoFalso()..documento = _cnpjDaReceita;
    await _abrir(tester, _app(servico));
    await tester.enterText(_campoDocumento(), '07127994000150');
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
    await tester.pumpAndSettle();

    expect(find.text('Adicione pelo menos um contato.'), findsOneWidget);
    expect(servico.criacoes, isEmpty);
  });

  testWidgets('fluxo completo: Receita + contato + salvar devolve o id e manda o payload certo', (tester) async {
    final servico = _ServicoFalso()..documento = _cnpjDaReceita;
    String? idDevolvido;
    await _abrir(tester, _app(servico, aoFechar: (id) => idDevolvido = id));

    await tester.enterText(_campoDocumento(), '07127994000150');
    await tester.pumpAndSettle();

    // Contato obrigatório, pela tela de contato.
    await tester.tap(find.widgetWithText(OutlinedButton, 'Adicionar'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Nome'), 'Maria');
    await tester.enterText(find.widgetWithText(TextField, 'Cargo'), 'Compras');
    await tester.tap(find.widgetWithText(FilledButton, 'Criar'));
    await tester.pumpAndSettle();
    expect(find.text('Maria'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
    await tester.pumpAndSettle();

    expect(idDevolvido, 'cliente-novo');
    expect(servico.criacoes, hasLength(1));
    final payload = servico.criacoes.single;
    expect(payload['cpfCnpj'], '07.127.994/0001-50');
    expect(payload['razaoSocial'], 'MEGA FIOS LTDA');
    expect(payload['nomeFantasia'], 'MEGA');
    expect(payload['email'], 'contato@megafios.com.br');
    expect(payload['telefones'], [
      {'ddd': '86', 'numero': '32188383'},
    ]);
    expect((payload['enderecoCobranca'] as Map)['cep'], '64076130');
    // "Entrega igual à cobrança": o mesmo endereço vai nos dois.
    expect(payload['enderecoEntrega'], payload['enderecoCobranca']);
    expect(payload['contatos'], [
      {'nome': 'Maria', 'funcao': 'Compras'},
    ]);
  });

  testWidgets('remover o único contato volta a bloquear a gravação', (tester) async {
    final servico = _ServicoFalso()..documento = _cnpjDaReceita;
    await _abrir(tester, _app(servico));
    await tester.enterText(_campoDocumento(), '07127994000150');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Adicionar'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Nome'), 'Maria');
    await tester.tap(find.widgetWithText(FilledButton, 'Criar'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Remover contato'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
    await tester.pumpAndSettle();

    expect(find.text('Adicione pelo menos um contato.'), findsOneWidget);
    expect(servico.criacoes, isEmpty);
  });

  testWidgets('trocar para pessoa física mostra RG/filiação e CPF', (tester) async {
    await _abrir(tester, _app(_ServicoFalso()));

    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextField, 'CPF'), findsOneWidget);
    expect(find.text('RG'), findsOneWidget);
    expect(find.text('Filiação'), findsOneWidget);
    expect(find.text('Nome Fantasia'), findsNothing);
  });

  group('edição', () {
    final cliente = ClienteEdicao(
      id: 'c1',
      cpfCnpj: '07.127.994/0001-50',
      tipoPessoa: TipoPessoa.juridica,
      codigo: '10458',
      razaoSocial: 'MEGA FIOS LTDA',
      nomeFantasia: 'MEGA',
      inscricaoEstadual: '123',
      email: 'contato@megafios.com.br',
      limiteCredito: 5000,
      rg: null,
      dataNascimento: null,
      nomeMae: null,
      camposPessoaFisicaConhecidos: false,
      enderecoCobranca: const EnderecoEdicao(
        cep: '64076130',
        logradouro: 'AV DEPUTADO PAULO FERRAZ',
        numero: '5250',
        semNumero: false,
        complemento: '',
        bairro: 'LIVRAMENTO',
        cidade: 'Teresina',
        uf: 'PI',
        codigoIbge: '2211001',
        idMunicipio: '52002816',
      ),
      enderecoEntrega: null,
      entregaIgualCobranca: true,
      telefones: const [Telefone(ddd: '86', numero: '32188383')],
    );

    Widget appEdicao(_ServicoFalso servico, {void Function(bool?)? aoFechar}) {
      return ProviderScope(
        overrides: [cadastroClienteServiceProvider.overrideWithValue(servico)],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () async {
                    final salvou = await Navigator.of(context).push<bool>(
                      MaterialPageRoute(builder: (_) => const ClienteFormScreen(clienteId: 'c1')),
                    );
                    aoFechar?.call(salvou);
                  },
                  child: const Text('abrir'),
                ),
              ),
            ),
          ),
        ),
      );
    }

    testWidgets('carrega o cliente; documento e código ficam travados; contatos não aparecem', (tester) async {
      final servico = _ServicoFalso()..edicao = cliente;
      await _abrir(tester, appEdicao(servico));

      expect(find.text('Editar cliente'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'MEGA FIOS LTDA'), findsOneWidget);
      expect(find.widgetWithText(TextField, '07.127.994/0001-50'), findsOneWidget);
      expect(tester.widget<TextField>(find.widgetWithText(TextField, '07.127.994/0001-50')).enabled, isFalse);
      expect(tester.widget<TextField>(find.widgetWithText(TextField, '10458')).enabled, isFalse);
      expect(find.text('Obrigatório: adicione pelo menos um contato.'), findsNothing);
      expect(find.byType(SwitchListTile), findsNothing);
      expect(find.text('AV DEPUTADO PAULO FERRAZ, 5250, LIVRAMENTO'), findsWidgets);
    });

    testWidgets('salvar manda os campos, mas NAO reenvia o endereço (so quando escolher outro)', (tester) async {
      final servico = _ServicoFalso()..edicao = cliente;
      bool? salvou;
      await _abrir(tester, appEdicao(servico, aoFechar: (v) => salvou = v));

      await tester.enterText(find.widgetWithText(TextField, 'contato@megafios.com.br'), 'vendas@megafios.com.br');
      await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
      await tester.pumpAndSettle();

      expect(salvou, isTrue);
      final payload = servico.atualizacoes.single;
      expect(payload['email'], 'vendas@megafios.com.br');
      expect(payload['razaoSocial'], 'MEGA FIOS LTDA');
      expect(payload['limiteCredito'], 5000);
      expect(payload['entregaIgualCobranca'], isTrue);
      expect(payload, isNot(contains('enderecoCobranca')));
      expect(payload, isNot(contains('enderecoEntrega')));
    });

    testWidgets('servidor diz que nada mudou: avisa e continua na tela', (tester) async {
      final servico = _ServicoFalso()
        ..edicao = cliente
        ..situacaoDaEdicao = 'SEM_ALTERACAO';
      bool? salvou;
      await _abrir(tester, appEdicao(servico, aoFechar: (v) => salvou = v));

      await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
      await tester.pumpAndSettle();

      expect(find.text('Nada mudou - nenhuma alteração foi enviada.'), findsOneWidget);
      expect(find.text('Editar cliente'), findsOneWidget);
      expect(salvou, isNull);
    });

    testWidgets('razão social vazia é recusada antes de ir ao servidor', (tester) async {
      final servico = _ServicoFalso()..edicao = cliente;
      await _abrir(tester, appEdicao(servico));

      await tester.enterText(find.widgetWithText(TextField, 'MEGA FIOS LTDA'), '');
      await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
      await tester.pumpAndSettle();

      expect(find.text('Informe a razão social.'), findsOneWidget);
      expect(servico.atualizacoes, isEmpty);
    });
  });
}
