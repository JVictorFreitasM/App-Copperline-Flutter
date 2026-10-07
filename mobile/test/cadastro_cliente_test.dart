import 'package:flutter_test/flutter_test.dart';

import 'package:copperline_mobile/core/models/cadastro_cliente.dart';
import 'package:copperline_mobile/core/models/documento_brasileiro.dart';

// Lógica pura do cadastro de cliente - mesmos casos do web
// (frontend/src/lib/cadastro-cliente.ts) e do backend
// (clientes/domain/documento.ts), pra os três lados concordarem.
void main() {
  group('documento', () {
    test('CPF válido, com ou sem pontuação, é pessoa física', () {
      expect(tipoPessoaDoDocumento('529.982.247-25'), TipoPessoa.fisica);
      expect(tipoPessoaDoDocumento('52998224725'), TipoPessoa.fisica);
    });

    test('CNPJ válido (numérico e alfanumérico) é pessoa jurídica', () {
      expect(tipoPessoaDoDocumento('07127994000150'), TipoPessoa.juridica);
      expect(tipoPessoaDoDocumento('19.131.243/0001-97'), TipoPessoa.juridica);
      expect(tipoPessoaDoDocumento('12ABC34501DE35'), TipoPessoa.juridica);
      expect(tipoPessoaDoDocumento('12.abc.345/01de-35'), TipoPessoa.juridica);
    });

    test('rejeita DV errado, tamanho errado e sequência repetida', () {
      expect(tipoPessoaDoDocumento('529.982.247-26'), isNull);
      expect(tipoPessoaDoDocumento('07127994000151'), isNull);
      expect(tipoPessoaDoDocumento('11111111111'), isNull);
      expect(tipoPessoaDoDocumento('00000000000000'), isNull);
      expect(tipoPessoaDoDocumento('123'), isNull);
      expect(tipoPessoaDoDocumento(''), isNull);
      expect(tipoPessoaDoDocumento('1913124300019@'), isNull);
    });

    test('máscara de CNPJ progressiva, sem separador sobrando no fim', () {
      final passos = ['07', '07127', '07127994', '071279940001', '07127994000150']
          .map((v) => aplicarMascaraDocumento(v, TipoPessoa.juridica))
          .toList();
      expect(passos, ['07', '07.127', '07.127.994', '07.127.994/0001', '07.127.994/0001-50']);
    });

    test('máscara de CNPJ alfanumérico e de CPF', () {
      expect(aplicarMascaraDocumento('12abc34501de35', TipoPessoa.juridica), '12.ABC.345/01DE-35');
      final cpf = ['529', '529982', '529982247', '52998224725']
          .map((v) => aplicarMascaraDocumento(v, TipoPessoa.fisica))
          .toList();
      expect(cpf, ['529', '529.982', '529.982.247', '529.982.247-25']);
    });

    test('máscara de CPF ignora letras e o que passa de 11 dígitos', () {
      expect(aplicarMascaraDocumento('529.982.247-25999', TipoPessoa.fisica), '529.982.247-25');
      expect(aplicarMascaraDocumento('52a99', TipoPessoa.fisica), '529.9');
    });

    test('formata o documento completo como o WK Radar grava', () {
      expect(formatarDocumento('07127994000150'), '07.127.994/0001-50');
      expect(formatarDocumento('52998224725'), '529.982.247-25');
      expect(formatarDocumento('abc'), 'abc');
    });
  });

  group('CEP', () {
    test('valida 8 dígitos, com ou sem hífen, e rejeita zeros', () {
      expect(cepEhValido('01311902'), isTrue);
      expect(cepEhValido('01311-902'), isTrue);
      expect(cepEhValido('123'), isFalse);
      expect(cepEhValido('0131190A'), isFalse);
      expect(cepEhValido('00000000'), isFalse);
    });

    test('formata progressivamente', () {
      expect(formatarCep('01311'), '01311');
      expect(formatarCep('013119'), '01311-9');
      expect(formatarCep('01311902999'), '01311-902');
    });
  });

  group('telefone', () {
    test('formata 8 e 9 dígitos', () {
      expect(const Telefone(ddd: '86', numero: '32188383').formatado, '(86) 3218-8383');
      expect(const Telefone(ddd: '86', numero: '999998888').formatado, '(86) 99999-8888');
    });

    test('valida DDD de 2 dígitos e número de 8 ou 9', () {
      expect(const Telefone(ddd: '86', numero: '32188383').valido, isTrue);
      expect(const Telefone(ddd: '8', numero: '32188383').valido, isFalse);
      expect(const Telefone(ddd: '86', numero: '3218838').valido, isFalse);
    });

    test('extrai telefones do texto da Receita', () {
      expect(extrairTelefones('(86) 3218-8383'), [const Telefone(ddd: '86', numero: '32188383')]);
      expect(extrairTelefones('(86) 3218-8383 / (86) 99999-8888'), [
        const Telefone(ddd: '86', numero: '32188383'),
        const Telefone(ddd: '86', numero: '999998888'),
      ]);
      expect(extrairTelefones('3218-8383'), isEmpty);
      expect(extrairTelefones(null), isEmpty);
    });
  });

  group('valor monetário', () {
    test('aceita formato brasileiro e ponto', () {
      expect(parseValorMonetario('1.234,56'), 1234.56);
      expect(parseValorMonetario('5000'), 5000);
      expect(parseValorMonetario('10,5'), 10.5);
    });

    test('vazio, inválido ou negativo vira null', () {
      expect(parseValorMonetario(' '), isNull);
      expect(parseValorMonetario('abc'), isNull);
      expect(parseValorMonetario('-5'), isNull);
    });

    test('formata pro campo editável', () {
      expect(formatarValorParaCampo(1234.5), '1234,5');
      expect(formatarValorParaCampo(null), '');
    });
  });

  group('endereço', () {
    const endereco = EnderecoFormulario(
      cep: '64076-130',
      logradouro: 'AV DEPUTADO PAULO FERRAZ',
      numero: '5250',
      bairro: 'LIVRAMENTO',
      cidade: 'TERESINA',
      uf: 'PI',
      codigoIbge: '2211001',
    );

    test('completo exige CEP, logradouro, bairro e número (ou S/N)', () {
      expect(endereco.completo, isTrue);
      expect(endereco.copiarCom(numero: '').completo, isFalse);
      expect(endereco.copiarCom(numero: '', semNumero: true).completo, isTrue);
      expect(endereco.copiarCom(cep: '1234').completo, isFalse);
      expect(endereco.copiarCom(bairro: ' ').completo, isFalse);
    });

    test('descrição em duas linhas, como no mock de referência', () {
      expect(endereco.descricao, (
        'AV DEPUTADO PAULO FERRAZ, 5250, LIVRAMENTO',
        '64076-130 - TERESINA - PI - Brasil',
      ));
      expect(endereco.copiarCom(semNumero: true).descricao.$1, contains('S/N'));
    });

    test('consultas de localização do mais específico ao mais geral', () {
      expect(endereco.consultasDeLocalizacao, [
        'AV DEPUTADO PAULO FERRAZ, 5250, LIVRAMENTO, TERESINA - PI, 64076-130',
        'AV DEPUTADO PAULO FERRAZ, LIVRAMENTO, TERESINA - PI',
        '64076-130, TERESINA - PI',
      ]);
    });

    test('payload leva só o que existe e o pino quando definido', () {
      expect(endereco.paraPayload(), {
        'cep': '64076130',
        'logradouro': 'AV DEPUTADO PAULO FERRAZ',
        'semNumero': false,
        'numero': 5250,
        'bairro': 'LIVRAMENTO',
        'codigoIbge': '2211001',
        'cidade': 'TERESINA',
        'uf': 'PI',
      });
      final comPino = endereco.copiarCom(latitude: -5.08, longitude: -42.8);
      expect(comPino.paraPayload(), containsPair('latitude', -5.08));
      expect(comPino.paraPayload(), containsPair('longitude', -42.8));
    });

    test('sem número não manda o campo numero', () {
      final payload = endereco.copiarCom(semNumero: true, numero: '').paraPayload();
      expect(payload['semNumero'], isTrue);
      expect(payload, isNot(contains('numero')));
    });

    test('endereço vindo da edição preserva o idMunicipio do Radar', () {
      final editado = EnderecoEdicao.fromJson({
        'cep': '64076130',
        'logradouro': 'AV X',
        'numero': '10',
        'semNumero': false,
        'complemento': '',
        'bairro': 'B',
        'cidade': 'Teresina',
        'uf': 'PI',
        'codigoIbge': '2211001',
        'idMunicipio': '52002816',
      }).paraFormulario();

      expect(editado.paraPayload(), containsPair('idMunicipio', '52002816'));
      // Mudar o CEP no popup não pode manter o município do endereço antigo -
      // um endereço novo nasce sem idMunicipio (vai pelo IBGE).
      expect(const EnderecoFormulario().paraPayload(), isNot(contains('idMunicipio')));
    });
  });

  group('contato', () {
    test('payload só com o que foi preenchido', () {
      const contato = ContatoFormulario(
        nome: ' Maria ',
        funcao: 'Compras',
        telefone: Telefone(ddd: '86', numero: '999998888'),
        dataNascimento: '1990-05-20',
      );

      expect(contato.paraPayload(), {
        'nome': 'Maria',
        'funcao': 'Compras',
        'telefoneDdd': '86',
        'telefoneNumero': '999998888',
        'dataNascimento': '1990-05-20',
      });
      expect(const ContatoFormulario(nome: 'João').paraPayload(), {'nome': 'João'});
    });

    test('resumo mostra só o que existe', () {
      const contato = ContatoFormulario(
        nome: 'Maria',
        funcao: 'Compras',
        email: 'm@b.com',
        telefone: Telefone(ddd: '86', numero: '32188383'),
      );
      expect(contato.resumo, 'Compras · (86) 3218-8383 · m@b.com');
      expect(const ContatoFormulario(nome: 'X').resumo, '');
    });
  });

  group('payload de criação', () {
    const cobranca = EnderecoFormulario(
      cep: '64076130',
      logradouro: 'AV X',
      numero: '1',
      bairro: 'B',
      codigoIbge: '2211001',
    );
    const contato = ContatoFormulario(nome: 'Maria');

    test('pessoa jurídica: documento formatado, fantasia, sem campos de pessoa física', () {
      final payload = montarPayloadCriarCliente(
        documento: '07127994000150',
        tipo: TipoPessoa.juridica,
        razaoSocial: ' MEGA FIOS LTDA ',
        nomeFantasia: 'MEGA',
        rg: '123',
        nomeMae: 'Ana',
        cobranca: cobranca,
        contatos: [contato],
      );

      expect(payload['cpfCnpj'], '07.127.994/0001-50');
      expect(payload['razaoSocial'], 'MEGA FIOS LTDA');
      expect(payload['nomeFantasia'], 'MEGA');
      expect(payload, isNot(contains('rg')));
      expect(payload, isNot(contains('nomeMae')));
      expect(payload['contatos'], [
        {'nome': 'Maria'},
      ]);
    });

    test('pessoa física: RG/nascimento/mãe, sem nome fantasia', () {
      final payload = montarPayloadCriarCliente(
        documento: '52998224725',
        tipo: TipoPessoa.fisica,
        razaoSocial: 'Fulano',
        nomeFantasia: 'não deve ir',
        rg: '1234567',
        dataNascimento: '1990-05-20',
        nomeMae: 'Ana',
        cobranca: cobranca,
        contatos: [contato],
      );

      expect(payload['cpfCnpj'], '529.982.247-25');
      expect(payload, isNot(contains('nomeFantasia')));
      expect(payload['rg'], '1234567');
      expect(payload['dataNascimento'], '1990-05-20');
      expect(payload['nomeMae'], 'Ana');
    });

    test('opcionais ausentes ficam de fora; limite de crédito zero É enviado', () {
      final enxuto = montarPayloadCriarCliente(
        documento: '07127994000150',
        tipo: TipoPessoa.juridica,
        razaoSocial: 'X',
        cobranca: cobranca,
        contatos: [contato],
      );
      for (final campo in ['codigo', 'nomeFantasia', 'inscricaoEstadual', 'email', 'limiteCredito', 'telefones', 'enderecoEntrega']) {
        expect(enxuto, isNot(contains(campo)), reason: campo);
      }

      final comZero = montarPayloadCriarCliente(
        documento: '07127994000150',
        tipo: TipoPessoa.juridica,
        razaoSocial: 'X',
        cobranca: cobranca,
        limiteCredito: 0,
        contatos: [contato],
      );
      expect(comZero['limiteCredito'], 0);
    });

    test('entrega e telefones entram quando informados', () {
      final payload = montarPayloadCriarCliente(
        documento: '07127994000150',
        tipo: TipoPessoa.juridica,
        razaoSocial: 'X',
        cobranca: cobranca,
        entrega: cobranca.copiarCom(cep: '01311902'),
        telefones: const [Telefone(ddd: '86', numero: '32188383')],
        contatos: [contato],
      );

      expect((payload['enderecoEntrega'] as Map)['cep'], '01311902');
      expect(payload['telefones'], [
        {'ddd': '86', 'numero': '32188383'},
      ]);
    });
  });

  group('payload de edição', () {
    test('endereço só vai quando o usuário escolheu outro', () {
      final semEndereco = montarPayloadAtualizarCliente(
        fisica: false,
        razaoSocial: 'MEGA',
        nomeFantasia: 'M',
        inscricaoEstadual: '1',
        rg: '',
        dataNascimento: '',
        nomeMae: '',
        email: 'a@b.com',
        limiteCredito: 100,
        telefones: const [],
        entregaIgual: true,
      );
      expect(semEndereco, isNot(contains('enderecoCobranca')));
      expect(semEndereco, isNot(contains('enderecoEntrega')));
      expect(semEndereco['entregaIgualCobranca'], isTrue);
      expect(semEndereco['nomeFantasia'], 'M');
      expect(semEndereco, isNot(contains('rg')));

      final comEndereco = montarPayloadAtualizarCliente(
        fisica: true,
        razaoSocial: 'Fulano',
        nomeFantasia: '',
        inscricaoEstadual: '',
        rg: '12',
        dataNascimento: '',
        nomeMae: '',
        email: '',
        limiteCredito: null,
        telefones: const [],
        entregaIgual: false,
        novaCobranca: const EnderecoFormulario(cep: '64076130', logradouro: 'A', numero: '1', bairro: 'B'),
      );
      expect(comEndereco, contains('enderecoCobranca'));
      expect(comEndereco, isNot(contains('nomeFantasia')));
      expect(comEndereco, isNot(contains('limiteCredito')));
      expect(comEndereco['rg'], '12');
    });
  });

  group('DTOs de resposta', () {
    test('consulta de CNPJ de cliente que já está na base não traz dados da Receita', () {
      final resultado = ConsultaCnpjResultado.fromJson({
        'jaCadastrado': {'razaoSocial': 'MEGA', 'vendedorResponsavel': 'Joana'},
        'dados': null,
        'enderecoSugerido': null,
      });

      expect(resultado.dados, isNull);
      expect(resultado.jaCadastrado!.mensagem, 'Já cadastrado (MEGA) - vendedor responsável: Joana.');
    });

    test('consulta de CNPJ traz dados e endereço sugerido (que vira formulário)', () {
      final resultado = ConsultaCnpjResultado.fromJson({
        'jaCadastrado': null,
        'dados': {'razaoSocial': 'MEGA FIOS LTDA', 'nomeFantasia': null, 'email': null, 'telefone': '(86) 3218-8383'},
        'enderecoSugerido': {
          'cep': '64076130',
          'logradouro': 'AV X',
          'numero': null,
          'semNumero': true,
          'bairro': 'LIVRAMENTO',
          'municipio': 'TERESINA',
          'uf': 'PI',
          'codigoIbge': '2211001',
        },
      });

      expect(resultado.dados!.razaoSocial, 'MEGA FIOS LTDA');
      final endereco = resultado.enderecoSugerido!.paraFormulario()!;
      expect(endereco.cidade, 'TERESINA');
      expect(endereco.semNumero, isTrue);
      expect(endereco.codigoIbge, '2211001');
    });

    test('endereço sugerido sem CEP ou logradouro não vira formulário', () {
      expect(const EnderecoSugerido(cep: '64076130').paraFormulario(), isNull);
      expect(const EnderecoSugerido(logradouro: 'AV X').paraFormulario(), isNull);
    });

    test('cliente criado e geocodificação', () {
      expect(ClienteCriado.fromJson({'id': 'c1', 'statusEnvioErp': 'PENDENTE'}).statusEnvioErp, 'PENDENTE');
      final geo = Geocodificacao.fromJson({'latitude': -5, 'longitude': -42.8, 'nomeExibicao': 'x'});
      expect(geo.latitude, -5.0);
      expect(geo.longitude, -42.8);
    });

    test('dados de edição: entrega igual por padrão e telefones', () {
      final edicao = ClienteEdicao.fromJson({
        'id': 'c1',
        'cpfCnpj': '07.127.994/0001-50',
        'tipoPessoa': 'Juridica',
        'camposPessoaFisicaConhecidos': false,
        'enderecoCobranca': null,
        'enderecoEntrega': null,
        'telefones': [
          {'ddd': '86', 'numero': '32188383'},
        ],
      });

      expect(edicao.tipoPessoa, TipoPessoa.juridica);
      expect(edicao.entregaIgualCobranca, isTrue);
      expect(edicao.telefones.single.formatado, '(86) 3218-8383');
      expect(edicao.limiteCredito, isNull);
    });
  });
}
