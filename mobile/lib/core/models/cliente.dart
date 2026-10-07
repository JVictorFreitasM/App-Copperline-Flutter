/// Mesmo shape de `backend/src/clientes/dto/cliente-response.dto.ts` -
/// duplicado aqui por não haver pacote compartilhado entre mobile e back
/// (mesmo padrão já usado no web, `frontend/src/lib/clientes.ts`).
class ClienteResumo {
  const ClienteResumo({
    required this.id,
    required this.cpfCnpj,
    required this.razaoSocial,
    required this.nomeFantasia,
    required this.inativo,
    this.localizacaoLat,
    this.localizacaoLng,
    this.statusEnvioErp = 'ENVIADO',
    this.erroEnvioErp,
  });

  factory ClienteResumo.fromJson(Map<String, dynamic> json) {
    return ClienteResumo(
      id: json['id'] as String,
      cpfCnpj: json['cpfCnpj'] as String?,
      razaoSocial: json['razaoSocial'] as String?,
      nomeFantasia: json['nomeFantasia'] as String?,
      inativo: json['inativo'] as bool,
      localizacaoLat: (json['localizacaoLat'] as num?)?.toDouble(),
      localizacaoLng: (json['localizacaoLng'] as num?)?.toDouble(),
      statusEnvioErp: json['statusEnvioErp'] as String? ?? 'ENVIADO',
      erroEnvioErp: json['erroEnvioErp'] as String?,
    );
  }

  final String id;
  final String? cpfCnpj;
  final String? razaoSocial;
  final String? nomeFantasia;
  final bool inativo;
  // "Pin" de localizacao (OS-BACKEND-28, exposto em GET /clientes desde a
  // OS-MOBILE-17) - null quando o cliente ainda nao teve o pin definido.
  final double? localizacaoLat;
  final double? localizacaoLng;

  /// Cadastro feito pelo app: PENDENTE (na fila pro WK Radar) ou ERRO (o ERP
  /// recusou - ver [erroEnvioErp]). Cliente do sync é sempre ENVIADO; snapshot
  /// antigo, sem o campo, também.
  final String statusEnvioErp;
  final String? erroEnvioErp;

  bool get envioPendente => statusEnvioErp == 'PENDENTE';
  bool get envioComErro => statusEnvioErp == 'ERRO';

  String get titulo => razaoSocial ?? nomeFantasia ?? '—';

  bool get temLocalizacao => localizacaoLat != null && localizacaoLng != null;
}

/// Mesmo shape de `backend/src/clientes/cliente-estatisticas.service.ts`
/// (ClienteEstatisticasDto, GET /clientes/:id/estatisticas, OS-BACKEND-26) -
/// exibido no detalhe do cliente do app (OS-MOBILE-25), mesmos rótulos do
/// web (`frontend/src/app/clientes/[id]/page.tsx`).
class ClienteEstatisticas {
  const ClienteEstatisticas({
    required this.clienteId,
    required this.meses,
    required this.totalUltimosMeses,
    required this.totalGeral,
    required this.quantidadePedidos,
    required this.ticketMedio,
    required this.vendedorResponsavel,
  });

  factory ClienteEstatisticas.fromJson(Map<String, dynamic> json) {
    return ClienteEstatisticas(
      clienteId: json['clienteId'] as String,
      meses: json['meses'] as int,
      totalUltimosMeses: (json['totalUltimosMeses'] as num).toDouble(),
      totalGeral: (json['totalGeral'] as num).toDouble(),
      quantidadePedidos: json['quantidadePedidos'] as int,
      ticketMedio: (json['ticketMedio'] as num).toDouble(),
      vendedorResponsavel: json['vendedorResponsavel'] as String?,
    );
  }

  final String clienteId;
  final int meses;
  final double totalUltimosMeses;
  final double totalGeral;
  final int quantidadePedidos;
  final double ticketMedio;
  final String? vendedorResponsavel;
}

class ContatoCliente {
  const ContatoCliente({
    required this.id,
    required this.nome,
    required this.email,
    required this.telefoneDdd,
    required this.telefoneNumero,
    required this.funcao,
  });

  factory ContatoCliente.fromJson(Map<String, dynamic> json) {
    return ContatoCliente(
      id: json['id'] as String,
      nome: json['nome'] as String?,
      email: json['email'] as String?,
      telefoneDdd: json['telefoneDdd'] as String?,
      telefoneNumero: json['telefoneNumero'] as String?,
      funcao: json['funcao'] as String?,
    );
  }

  final String id;
  final String? nome;
  final String? email;
  final String? telefoneDdd;
  final String? telefoneNumero;
  final String? funcao;

  String? get telefoneFormatado =>
      telefoneDdd != null && telefoneNumero != null
      ? '($telefoneDdd) $telefoneNumero'
      : null;
}

class TelefoneEndereco {
  const TelefoneEndereco({required this.ddd, required this.numero});

  factory TelefoneEndereco.fromJson(Map<String, dynamic> json) {
    return TelefoneEndereco(ddd: json['ddd'] as String?, numero: json['numero'] as String);
  }

  final String? ddd;
  final String numero;

  String get formatado => ddd != null ? '($ddd) $numero' : numero;
}

/// Já normalizado pelo backend (`paraEnderecosClienteDto`) a partir do JSONB
/// cru do WK Radar. Sem nome de cidade: o Radar só manda idMunicipio/IBGE.
class EnderecoCliente {
  const EnderecoCliente({
    required this.tipo,
    required this.cep,
    required this.logradouro,
    required this.numero,
    required this.complemento,
    required this.bairro,
    required this.uf,
    required this.email,
    required this.telefones,
  });

  factory EnderecoCliente.fromJson(Map<String, dynamic> json) {
    return EnderecoCliente(
      tipo: json['tipo'] as String?,
      cep: json['cep'] as String?,
      logradouro: json['logradouro'] as String?,
      numero: json['numero'] as String?,
      complemento: json['complemento'] as String?,
      bairro: json['bairro'] as String?,
      uf: json['uf'] as String?,
      email: json['email'] as String?,
      telefones: (json['telefones'] as List)
          .cast<Map<String, dynamic>>()
          .map(TelefoneEndereco.fromJson)
          .toList(),
    );
  }

  final String? tipo;
  final String? cep;
  final String? logradouro;
  final String? numero;
  final String? complemento;
  final String? bairro;
  final String? uf;
  final String? email;
  final List<TelefoneEndereco> telefones;

  /// Linhas prontas pra exibição (rua/número/complemento, bairro - UF, CEP).
  List<String> get linhas {
    final rua = [logradouro, numero].whereType<String>().join(', ');
    final bairroUf = [bairro, uf].whereType<String>().join(' - ');
    return [
      [rua, complemento].whereType<String>().where((t) => t.isNotEmpty).join(' - '),
      bairroUf,
      if (cep != null) 'CEP $cep',
    ].where((linha) => linha.isNotEmpty).toList();
  }
}

/// Última edição ainda NÃO aplicada no WK Radar (PENDENTE na fila, ou ERRO -
/// o ERP recusou).
class AlteracaoErp {
  const AlteracaoErp({required this.status, this.erro});

  factory AlteracaoErp.fromJson(Map<String, dynamic> json) =>
      AlteracaoErp(status: json['status'] as String, erro: json['erro'] as String?);

  final String status;
  final String? erro;

  bool get comErro => status == 'ERRO';
}

class ClienteDetalhe extends ClienteResumo {
  const ClienteDetalhe({
    required super.id,
    required super.cpfCnpj,
    required super.razaoSocial,
    required super.nomeFantasia,
    required super.inativo,
    super.localizacaoLat,
    super.localizacaoLng,
    super.statusEnvioErp,
    super.erroEnvioErp,
    this.alteracaoErp,
    required this.idExternoErp,
    required this.codigo,
    required this.email,
    required this.contato,
    required this.homepage,
    required this.inscricaoEstadual,
    required this.enderecos,
    required this.contatos,
  });

  factory ClienteDetalhe.fromJson(Map<String, dynamic> json) {
    return ClienteDetalhe(
      id: json['id'] as String,
      cpfCnpj: json['cpfCnpj'] as String?,
      razaoSocial: json['razaoSocial'] as String?,
      nomeFantasia: json['nomeFantasia'] as String?,
      inativo: json['inativo'] as bool,
      localizacaoLat: (json['localizacaoLat'] as num?)?.toDouble(),
      localizacaoLng: (json['localizacaoLng'] as num?)?.toDouble(),
      statusEnvioErp: json['statusEnvioErp'] as String? ?? 'ENVIADO',
      erroEnvioErp: json['erroEnvioErp'] as String?,
      alteracaoErp: json['alteracaoErp'] is Map<String, dynamic>
          ? AlteracaoErp.fromJson(json['alteracaoErp'] as Map<String, dynamic>)
          : null,
      idExternoErp: json['idExternoErp'] as String,
      codigo: json['codigo'] as String?,
      email: json['email'] as String?,
      contato: json['contato'] as String?,
      homepage: json['homepage'] as String?,
      inscricaoEstadual: json['inscricaoEstadual'] as String?,
      enderecos: (json['enderecos'] as List)
          .cast<Map<String, dynamic>>()
          .map(EnderecoCliente.fromJson)
          .toList(),
      contatos: (json['contatos'] as List)
          .cast<Map<String, dynamic>>()
          .map(ContatoCliente.fromJson)
          .toList(),
    );
  }

  /// Edição ainda não aplicada no Radar; null = nenhuma pendência.
  final AlteracaoErp? alteracaoErp;

  /// ID do cliente no ERP (WK Radar) - `id` acima é o uuid interno.
  final String idExternoErp;
  final String? codigo;
  final String? email;
  final String? contato;
  final String? homepage;
  final String? inscricaoEstadual;
  final List<EnderecoCliente> enderecos;
  final List<ContatoCliente> contatos;

  /// Telefones de todos os endereços, sem repetição (é onde o ERP guarda).
  List<String> get telefones => {
    for (final endereco in enderecos)
      for (final telefone in endereco.telefones) telefone.formatado,
  }.toList();

  /// E-mail do cadastro + e-mails dos endereços, sem repetição.
  List<String> get emails => {
    ?email,
    for (final endereco in enderecos)
      ?endereco.email,
  }.toList();
}
