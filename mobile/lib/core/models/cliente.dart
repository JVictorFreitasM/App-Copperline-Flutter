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

  String get titulo => razaoSocial ?? nomeFantasia ?? '—';

  bool get temLocalizacao => localizacaoLat != null && localizacaoLng != null;
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

class ClienteDetalhe extends ClienteResumo {
  const ClienteDetalhe({
    required super.id,
    required super.cpfCnpj,
    required super.razaoSocial,
    required super.nomeFantasia,
    required super.inativo,
    super.localizacaoLat,
    super.localizacaoLng,
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
      contatos: (json['contatos'] as List)
          .cast<Map<String, dynamic>>()
          .map(ContatoCliente.fromJson)
          .toList(),
    );
  }

  // `enderecos` não é exposto aqui (mesmo motivo do web, ver
  // frontend/src/lib/clientes.ts): JSONB cru do WK Radar, sem schema
  // estável - fora de escopo mostrar num formulário fixo.
  final List<ContatoCliente> contatos;
}
