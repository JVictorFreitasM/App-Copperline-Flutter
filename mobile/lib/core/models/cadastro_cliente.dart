/// Cadastro e edição de cliente (mobile) - formulário, payloads e DTOs. Mesmo
/// contrato de `backend/src/clientes/dto/criar-cliente.dto.ts`,
/// `atualizar-cliente.dto.ts` e dos módulos consulta-cnpj/consulta-cep/
/// geocodificacao, e espelho de `frontend/src/lib/cadastro-cliente.ts` -
/// duplicado aqui por não haver pacote compartilhado entre mobile e back.
library;

import 'documento_brasileiro.dart';

// ---------------------------------------------------------------- endereço

String? _ou(String? valor) {
  final texto = valor?.trim();
  return texto == null || texto.isEmpty ? null : texto;
}

/// Endereço como a tela o edita (cobrança/entrega). Imutável - cada mudança
/// gera uma cópia nova (`copiarCom`).
class EnderecoFormulario {
  const EnderecoFormulario({
    this.cep = '',
    this.logradouro = '',
    this.numero = '',
    this.semNumero = false,
    this.complemento = '',
    this.bairro = '',
    this.cidade = '',
    this.uf = '',
    this.codigoIbge,
    this.idMunicipio,
    this.latitude,
    this.longitude,
  });

  final String cep;
  final String logradouro;
  final String numero;
  final bool semNumero;
  final String complemento;
  final String bairro;
  final String cidade;
  final String uf;
  final String? codigoIbge;

  /// Id do município no WK Radar - só existe pra endereço que já veio do
  /// cadastro (edição); endereço novo vai pelo IBGE.
  final String? idMunicipio;
  final double? latitude;
  final double? longitude;

  bool get temPino => latitude != null && longitude != null;

  /// Mínimo pro Radar aceitar: CEP, logradouro, bairro e número (ou S/N).
  bool get completo =>
      normalizarCep(cep).length == 8 &&
      logradouro.trim().isNotEmpty &&
      bairro.trim().isNotEmpty &&
      (semNumero || RegExp(r'^\d+$').hasMatch(numero.trim()));

  /// Duas linhas, como no mock de referência: "AVENIDA X, 391, BAIRRO" e
  /// "64003-600 - TERESINA - PI - Brasil".
  (String, String) get descricao {
    final primeira = [
      logradouro,
      semNumero ? 'S/N' : numero,
      bairro,
    ].where((parte) => parte.trim().isNotEmpty).join(', ');
    final segunda = [
      formatarCep(cep),
      cidade,
      uf,
      'Brasil',
    ].where((parte) => parte.trim().isNotEmpty).join(' - ');
    return (primeira, segunda);
  }

  /// Textos pro "Localizar" (geocodificação), do mais específico pro mais
  /// geral - o backend aceita texto livre.
  List<String> get consultasDeLocalizacao {
    final cidadeUf = [cidade, uf].where((p) => p.trim().isNotEmpty).join(' - ');
    String junta(List<String> partes) => partes.where((p) => p.trim().isNotEmpty).join(', ');
    final consultas = {
      junta([logradouro, semNumero ? '' : numero, bairro, cidadeUf, formatarCep(cep)]),
      junta([logradouro, bairro, cidadeUf]),
      junta([formatarCep(cep), cidadeUf]),
    };
    return consultas.where((texto) => texto.length >= 5).toList();
  }

  EnderecoFormulario copiarCom({
    String? cep,
    String? logradouro,
    String? numero,
    bool? semNumero,
    String? complemento,
    String? bairro,
    String? cidade,
    String? uf,
    String? codigoIbge,
    bool limparCodigoIbge = false,
    double? latitude,
    double? longitude,
  }) {
    return EnderecoFormulario(
      cep: cep ?? this.cep,
      logradouro: logradouro ?? this.logradouro,
      numero: numero ?? this.numero,
      semNumero: semNumero ?? this.semNumero,
      complemento: complemento ?? this.complemento,
      bairro: bairro ?? this.bairro,
      cidade: cidade ?? this.cidade,
      uf: uf ?? this.uf,
      codigoIbge: limparCodigoIbge ? null : (codigoIbge ?? this.codigoIbge),
      idMunicipio: idMunicipio,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
    );
  }

  /// Corpo de `enderecoCobranca`/`enderecoEntrega` (EnderecoClienteDto).
  Map<String, dynamic> paraPayload() {
    final ufLimpa = uf.trim();
    return {
      'cep': normalizarCep(cep),
      'logradouro': logradouro.trim(),
      'semNumero': semNumero,
      if (!semNumero) 'numero': ?int.tryParse(numero.trim()),
      if (_ou(complemento) != null) 'complemento': complemento.trim(),
      'bairro': bairro.trim(),
      'codigoIbge': ?codigoIbge,
      'idMunicipio': ?idMunicipio,
      if (_ou(cidade) != null) 'cidade': cidade.trim(),
      if (RegExp(r'^[A-Za-z]{2}$').hasMatch(ufLimpa)) 'uf': ufLimpa,
      if (temPino) 'latitude': latitude,
      if (temPino) 'longitude': longitude,
    };
  }
}

// ----------------------------------------------------------------- contato

class ContatoFormulario {
  const ContatoFormulario({
    required this.nome,
    this.funcao = '',
    this.email = '',
    this.telefone,
    this.dataNascimento = '',
  });

  final String nome;
  final String funcao;
  final String email;

  /// O contato do cadastro no Radar tem UM telefone.
  final Telefone? telefone;

  /// ISO `aaaa-MM-dd` ou vazio.
  final String dataNascimento;

  /// Limites do CreateContatoDto do Radar: nome 50, função 30, e-mail 64.
  Map<String, dynamic> paraPayload() => {
    'nome': nome.trim(),
    if (_ou(funcao) != null) 'funcao': funcao.trim(),
    if (_ou(email) != null) 'email': email.trim(),
    if (telefone != null) 'telefoneDdd': telefone!.ddd,
    if (telefone != null) 'telefoneNumero': telefone!.numero,
    if (_ou(dataNascimento) != null) 'dataNascimento': dataNascimento.trim(),
  };

  /// "Compras · (86) 3218-8383 · a@b.com" - o que sobrar preenchido.
  String get resumo => [
    funcao,
    if (telefone != null) telefone!.formatado,
    email,
  ].where((parte) => parte.trim().isNotEmpty).join(' · ');
}

// -------------------------------------------------------------- consultas

String? _texto(dynamic valor) => valor is String ? valor : null;

class ClienteJaCadastrado {
  const ClienteJaCadastrado({this.razaoSocial, this.vendedorResponsavel});

  factory ClienteJaCadastrado.fromJson(Map<String, dynamic> json) => ClienteJaCadastrado(
    razaoSocial: _texto(json['razaoSocial']),
    vendedorResponsavel: _texto(json['vendedorResponsavel']),
  );

  final String? razaoSocial;
  final String? vendedorResponsavel;

  String get mensagem {
    final nome = razaoSocial != null ? ' ($razaoSocial)' : '';
    final vendedor = vendedorResponsavel != null
        ? ' - vendedor responsável: $vendedorResponsavel'
        : '';
    return 'Já cadastrado$nome$vendedor.';
  }
}

/// Endereço pronto pro cadastro: dado da Receita + IBGE (API de CEP) + id do
/// município no WK Radar.
class EnderecoSugerido {
  const EnderecoSugerido({
    this.cep,
    this.logradouro,
    this.numero,
    this.semNumero = false,
    this.complemento,
    this.bairro,
    this.municipio,
    this.uf,
    this.codigoIbge,
  });

  factory EnderecoSugerido.fromJson(Map<String, dynamic> json) => EnderecoSugerido(
    cep: _texto(json['cep']),
    logradouro: _texto(json['logradouro']),
    numero: _texto(json['numero']),
    semNumero: json['semNumero'] == true,
    complemento: _texto(json['complemento']),
    bairro: _texto(json['bairro']),
    municipio: _texto(json['municipio']),
    uf: _texto(json['uf']),
    codigoIbge: _texto(json['codigoIbge']),
  );

  final String? cep;
  final String? logradouro;
  final String? numero;
  final bool semNumero;
  final String? complemento;
  final String? bairro;
  final String? municipio;
  final String? uf;
  final String? codigoIbge;

  /// Sem CEP e logradouro não há o que cadastrar.
  EnderecoFormulario? paraFormulario() {
    if (cep == null || logradouro == null) return null;
    return EnderecoFormulario(
      cep: cep!,
      logradouro: logradouro!,
      numero: numero ?? '',
      semNumero: semNumero,
      complemento: complemento ?? '',
      bairro: bairro ?? '',
      cidade: municipio ?? '',
      uf: uf ?? '',
      codigoIbge: codigoIbge,
    );
  }
}

class DadosEmpresa {
  const DadosEmpresa({required this.razaoSocial, this.nomeFantasia, this.email, this.telefone});

  factory DadosEmpresa.fromJson(Map<String, dynamic> json) => DadosEmpresa(
    razaoSocial: _texto(json['razaoSocial']) ?? '',
    nomeFantasia: _texto(json['nomeFantasia']),
    email: _texto(json['email']),
    telefone: _texto(json['telefone']),
  );

  final String razaoSocial;
  final String? nomeFantasia;
  final String? email;
  final String? telefone;
}

/// GET /consulta-cnpj/:cnpj. Quando o CNPJ já está na base da empresa,
/// `jaCadastrado` vem preenchido e `dados` é null (o backend nem consulta a
/// Receita).
class ConsultaCnpjResultado {
  const ConsultaCnpjResultado({this.jaCadastrado, this.dados, this.enderecoSugerido});

  factory ConsultaCnpjResultado.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic>? mapa(String chave) =>
        json[chave] is Map<String, dynamic> ? json[chave] as Map<String, dynamic> : null;
    final jaCadastrado = mapa('jaCadastrado');
    final dados = mapa('dados');
    final endereco = mapa('enderecoSugerido');
    return ConsultaCnpjResultado(
      jaCadastrado: jaCadastrado == null ? null : ClienteJaCadastrado.fromJson(jaCadastrado),
      dados: dados == null ? null : DadosEmpresa.fromJson(dados),
      enderecoSugerido: endereco == null ? null : EnderecoSugerido.fromJson(endereco),
    );
  }

  final ClienteJaCadastrado? jaCadastrado;
  final DadosEmpresa? dados;
  final EnderecoSugerido? enderecoSugerido;
}

class ConsultaCep {
  const ConsultaCep({this.logradouro, this.complemento, this.bairro, this.localidade, this.uf, this.codigoIbge});

  factory ConsultaCep.fromJson(Map<String, dynamic> json) => ConsultaCep(
    logradouro: _texto(json['logradouro']),
    complemento: _texto(json['complemento']),
    bairro: _texto(json['bairro']),
    localidade: _texto(json['localidade']),
    uf: _texto(json['uf']),
    codigoIbge: _texto(json['codigoIbge']),
  );

  final String? logradouro;
  final String? complemento;
  final String? bairro;
  final String? localidade;
  final String? uf;
  final String? codigoIbge;
}

class Geocodificacao {
  const Geocodificacao({required this.latitude, required this.longitude});

  factory Geocodificacao.fromJson(Map<String, dynamic> json) => Geocodificacao(
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
  );

  final double latitude;
  final double longitude;
}

// ---------------------------------------------------------------- criação

class ClienteCriado {
  const ClienteCriado({required this.id, required this.statusEnvioErp});

  factory ClienteCriado.fromJson(Map<String, dynamic> json) =>
      ClienteCriado(id: json['id'] as String, statusEnvioErp: json['statusEnvioErp'] as String);

  final String id;

  /// PENDENTE (na fila pro WK Radar), ENVIADO ou ERRO.
  final String statusEnvioErp;
}

/// Corpo do POST /clientes. Campo ausente fica de fora (nunca "" ou 0) -
/// mesmo critério do web. Limites de tamanho = os do Radar (swagger).
Map<String, dynamic> montarPayloadCriarCliente({
  required String documento,
  required TipoPessoa tipo,
  String codigo = '',
  required String razaoSocial,
  String nomeFantasia = '',
  String inscricaoEstadual = '',
  String rg = '',
  String dataNascimento = '',
  String nomeMae = '',
  required EnderecoFormulario cobranca,
  EnderecoFormulario? entrega,
  List<Telefone> telefones = const [],
  String email = '',
  double? limiteCredito,
  required List<ContatoFormulario> contatos,
}) {
  final fisica = tipo == TipoPessoa.fisica;
  return {
    'cpfCnpj': formatarDocumento(documento),
    if (_ou(codigo) != null) 'codigo': codigo.trim(),
    'razaoSocial': razaoSocial.trim(),
    if (!fisica && _ou(nomeFantasia) != null) 'nomeFantasia': nomeFantasia.trim(),
    if (_ou(inscricaoEstadual) != null) 'inscricaoEstadual': inscricaoEstadual.trim(),
    if (fisica && _ou(rg) != null) 'rg': rg.trim(),
    if (fisica && _ou(dataNascimento) != null) 'dataNascimento': dataNascimento.trim(),
    if (fisica && _ou(nomeMae) != null) 'nomeMae': nomeMae.trim(),
    'enderecoCobranca': cobranca.paraPayload(),
    'enderecoEntrega': ?entrega?.paraPayload(),
    if (telefones.isNotEmpty) 'telefones': [for (final t in telefones) t.toJson()],
    if (_ou(email) != null) 'email': email.trim(),
    'limiteCredito': ?limiteCredito,
    'contatos': [for (final c in contatos) c.paraPayload()],
  };
}

// ----------------------------------------------------------------- edição

class EnderecoEdicao {
  const EnderecoEdicao({
    required this.cep,
    required this.logradouro,
    required this.numero,
    required this.semNumero,
    required this.complemento,
    required this.bairro,
    required this.cidade,
    required this.uf,
    required this.codigoIbge,
    required this.idMunicipio,
  });

  factory EnderecoEdicao.fromJson(Map<String, dynamic> json) => EnderecoEdicao(
    cep: json['cep'] as String? ?? '',
    logradouro: json['logradouro'] as String? ?? '',
    numero: json['numero'] as String? ?? '',
    semNumero: json['semNumero'] == true,
    complemento: json['complemento'] as String? ?? '',
    bairro: json['bairro'] as String? ?? '',
    cidade: json['cidade'] as String? ?? '',
    uf: json['uf'] as String? ?? '',
    codigoIbge: json['codigoIbge'] as String?,
    idMunicipio: json['idMunicipio'] as String?,
  );

  final String cep;
  final String logradouro;
  final String numero;
  final bool semNumero;
  final String complemento;
  final String bairro;
  final String cidade;
  final String uf;
  final String? codigoIbge;
  final String? idMunicipio;

  EnderecoFormulario paraFormulario() => EnderecoFormulario(
    cep: cep,
    logradouro: logradouro,
    numero: numero,
    semNumero: semNumero,
    complemento: complemento,
    bairro: bairro,
    cidade: cidade,
    uf: uf,
    codigoIbge: codigoIbge,
    idMunicipio: idMunicipio,
  );
}

/// GET /clientes/:id/edicao - o que a tela de edição precisa, no formato do
/// formulário.
class ClienteEdicao {
  const ClienteEdicao({
    required this.id,
    required this.cpfCnpj,
    required this.tipoPessoa,
    required this.codigo,
    required this.razaoSocial,
    required this.nomeFantasia,
    required this.inscricaoEstadual,
    required this.email,
    required this.limiteCredito,
    required this.rg,
    required this.dataNascimento,
    required this.nomeMae,
    required this.camposPessoaFisicaConhecidos,
    required this.enderecoCobranca,
    required this.enderecoEntrega,
    required this.entregaIgualCobranca,
    required this.telefones,
  });

  factory ClienteEdicao.fromJson(Map<String, dynamic> json) {
    EnderecoEdicao? endereco(String chave) => json[chave] is Map<String, dynamic>
        ? EnderecoEdicao.fromJson(json[chave] as Map<String, dynamic>)
        : null;
    return ClienteEdicao(
      id: json['id'] as String,
      cpfCnpj: json['cpfCnpj'] as String?,
      tipoPessoa: TipoPessoaValor.deValor(json['tipoPessoa'] as String?),
      codigo: json['codigo'] as String?,
      razaoSocial: json['razaoSocial'] as String?,
      nomeFantasia: json['nomeFantasia'] as String?,
      inscricaoEstadual: json['inscricaoEstadual'] as String?,
      email: json['email'] as String?,
      limiteCredito: (json['limiteCredito'] as num?)?.toDouble(),
      rg: json['rg'] as String?,
      dataNascimento: json['dataNascimento'] as String?,
      nomeMae: json['nomeMae'] as String?,
      camposPessoaFisicaConhecidos: json['camposPessoaFisicaConhecidos'] == true,
      enderecoCobranca: endereco('enderecoCobranca'),
      enderecoEntrega: endereco('enderecoEntrega'),
      entregaIgualCobranca: json['entregaIgualCobranca'] != false,
      telefones: (json['telefones'] as List? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(Telefone.fromJson)
          .toList(),
    );
  }

  final String id;
  final String? cpfCnpj;
  final TipoPessoa? tipoPessoa;
  final String? codigo;
  final String? razaoSocial;
  final String? nomeFantasia;
  final String? inscricaoEstadual;
  final String? email;
  final double? limiteCredito;
  final String? rg;
  final String? dataNascimento;
  final String? nomeMae;

  /// false = cliente veio do sync: RG/nascimento/mãe não são conhecidos aqui
  /// (em branco na tela = mantém o que está no Radar).
  final bool camposPessoaFisicaConhecidos;
  final EnderecoEdicao? enderecoCobranca;
  final EnderecoEdicao? enderecoEntrega;
  final bool entregaIgualCobranca;
  final List<Telefone> telefones;
}

/// Corpo do PATCH /clientes/:id - campo ausente não muda; "" limpa. O backend
/// compara com o que já tem e só leva ao ERP o que mudou.
Map<String, dynamic> montarPayloadAtualizarCliente({
  required bool fisica,
  required String razaoSocial,
  required String nomeFantasia,
  required String inscricaoEstadual,
  required String rg,
  required String dataNascimento,
  required String nomeMae,
  required String email,
  required double? limiteCredito,
  required List<Telefone> telefones,
  required bool entregaIgual,
  EnderecoFormulario? novaCobranca,
  EnderecoFormulario? novaEntrega,
}) {
  return {
    'razaoSocial': razaoSocial.trim(),
    if (!fisica) 'nomeFantasia': nomeFantasia.trim(),
    'inscricaoEstadual': inscricaoEstadual.trim(),
    'email': email.trim(),
    'limiteCredito': ?limiteCredito,
    if (fisica) ...{
      'rg': rg.trim(),
      'dataNascimento': dataNascimento.trim(),
      'nomeMae': nomeMae.trim(),
    },
    'telefones': [for (final t in telefones) t.toJson()],
    'entregaIgualCobranca': entregaIgual,
    'enderecoCobranca': ?novaCobranca?.paraPayload(),
    'enderecoEntrega': ?novaEntrega?.paraPayload(),
  };
}
