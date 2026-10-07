/// Validação e formatação de CPF/CNPJ/CEP/telefone - lógica pura (sem Flutter,
/// sem rede), espelho de `frontend/src/lib/cadastro-cliente.ts` e de
/// `backend/src/clientes/domain/documento.ts` (o backend valida de novo: o
/// app não é confiável). Validar aqui ANTES de qualquer chamada dá feedback
/// imediato e economiza requisição do provedor externo de CNPJ.
library;

enum TipoPessoa { fisica, juridica }

extension TipoPessoaValor on TipoPessoa {
  /// Valor que o backend/WK Radar espera (`tipoPessoa`).
  String get valor => this == TipoPessoa.fisica ? 'Fisica' : 'Juridica';

  static TipoPessoa? deValor(String? valor) => switch (valor) {
    'Fisica' => TipoPessoa.fisica,
    'Juridica' => TipoPessoa.juridica,
    _ => null,
  };
}

const _pesosPrimeiroDv = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const _pesosSegundoDv = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/// Tira pontuação/espaços e põe em maiúsculas (CNPJ alfanumérico novo).
String normalizarDocumento(String entrada) =>
    entrada.replaceAll(RegExp(r'[.\-/\s]'), '').toUpperCase();

bool _todosIguais(String texto) => texto.split('').toSet().length == 1;

bool cpfEhValido(String entrada) {
  final cpf = normalizarDocumento(entrada);
  if (!RegExp(r'^\d{11}$').hasMatch(cpf) || _todosIguais(cpf)) {
    return false;
  }
  int digito(String base, int pesoInicial) {
    var soma = 0;
    for (var i = 0; i < base.length; i++) {
      soma += int.parse(base[i]) * (pesoInicial - i);
    }
    final resto = (soma * 10) % 11;
    return resto == 10 ? 0 : resto;
  }

  return digito(cpf.substring(0, 9), 10) == int.parse(cpf[9]) &&
      digito(cpf.substring(0, 10), 11) == int.parse(cpf[10]);
}

/// CNPJ numérico e alfanumérico (12 posições [0-9A-Z] + 2 DV numéricos).
bool cnpjEhValido(String entrada) {
  final cnpj = normalizarDocumento(entrada);
  if (!RegExp(r'^[0-9A-Z]{12}[0-9]{2}$').hasMatch(cnpj) || _todosIguais(cnpj)) {
    return false;
  }
  int digito(String base, List<int> pesos) {
    var soma = 0;
    for (var i = 0; i < base.length; i++) {
      // Valor do caractere no cálculo: código ASCII - 48 ('0'=0 ... 'A'=17).
      soma += (base.codeUnitAt(i) - 48) * pesos[i];
    }
    final resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  final primeiro = digito(cnpj.substring(0, 12), _pesosPrimeiroDv);
  final segundo = digito(cnpj.substring(0, 13), _pesosSegundoDv);
  return cnpj.endsWith('$primeiro$segundo');
}

/// 11 dígitos = CPF (física), 14 caracteres = CNPJ (jurídica) - os tamanhos
/// nunca colidem. `null` = não é nenhum dos dois, ou DV inválido.
TipoPessoa? tipoPessoaDoDocumento(String entrada) {
  final documento = normalizarDocumento(entrada);
  if (documento.length == 11) {
    return cpfEhValido(documento) ? TipoPessoa.fisica : null;
  }
  return cnpjEhValido(documento) ? TipoPessoa.juridica : null;
}

String _mascarar(String caracteres, Map<int, String> separadores) {
  final saida = StringBuffer();
  for (var i = 0; i < caracteres.length; i++) {
    saida.write(caracteres[i]);
    final separador = separadores[i + 1];
    // Separador só entre caracteres - nunca sobrando no fim enquanto digita.
    if (separador != null && i + 1 < caracteres.length) {
      saida.write(separador);
    }
  }
  return saida.toString();
}

const _separadoresCpf = {3: '.', 6: '.', 9: '-'};
const _separadoresCnpj = {2: '.', 5: '.', 8: '/', 12: '-'};

/// Máscara progressiva enquanto digita: CPF só dígitos, CNPJ aceita letras.
String aplicarMascaraDocumento(String entrada, TipoPessoa tipo) {
  final limpo = normalizarDocumento(entrada);
  if (tipo == TipoPessoa.fisica) {
    final digitos = limpo.replaceAll(RegExp(r'\D'), '');
    return _mascarar(digitos.length > 11 ? digitos.substring(0, 11) : digitos, _separadoresCpf);
  }
  final caracteres = limpo.replaceAll(RegExp(r'[^0-9A-Z]'), '');
  return _mascarar(
    caracteres.length > 14 ? caracteres.substring(0, 14) : caracteres,
    _separadoresCnpj,
  );
}

/// Documento completo formatado (como o WK Radar grava) - entrada inválida
/// volta como veio.
String formatarDocumento(String entrada) {
  final documento = normalizarDocumento(entrada);
  if (documento.length == 11) return _mascarar(documento, _separadoresCpf);
  if (documento.length == 14) return _mascarar(documento, _separadoresCnpj);
  return entrada;
}

// ------------------------------------------------------------------- CEP

String normalizarCep(String entrada) => entrada.replaceAll(RegExp(r'[.\-\s]'), '');

bool cepEhValido(String entrada) {
  final cep = normalizarCep(entrada);
  return RegExp(r'^\d{8}$').hasMatch(cep) && cep != '00000000';
}

String formatarCep(String entrada) {
  final digitos = entrada.replaceAll(RegExp(r'\D'), '');
  final cortado = digitos.length > 8 ? digitos.substring(0, 8) : digitos;
  return cortado.length > 5 ? '${cortado.substring(0, 5)}-${cortado.substring(5)}' : cortado;
}

// -------------------------------------------------------------- telefone

class Telefone {
  const Telefone({required this.ddd, required this.numero});

  factory Telefone.fromJson(Map<String, dynamic> json) =>
      Telefone(ddd: json['ddd'] as String, numero: json['numero'] as String);

  final String ddd;
  final String numero;

  Map<String, dynamic> toJson() => {'ddd': ddd, 'numero': numero};

  /// (86) 3218-8383 / (86) 99999-8888.
  String get formatado {
    final corte = numero.length - 4;
    return '($ddd) ${numero.substring(0, corte)}-${numero.substring(corte)}';
  }

  /// DDD de 2 dígitos e número de 8 ou 9 (o que o Radar aceita).
  bool get valido => RegExp(r'^\d{2}$').hasMatch(ddd) && RegExp(r'^\d{8,9}$').hasMatch(numero);

  @override
  bool operator ==(Object other) =>
      other is Telefone && other.ddd == ddd && other.numero == numero;

  @override
  int get hashCode => Object.hash(ddd, numero);
}

/// A Receita devolve "(86) 3218-8383" ou vários separados por "/" - extrai só
/// o que tem DDD + 8/9 dígitos.
List<Telefone> extrairTelefones(String? texto) {
  if (texto == null) return const [];
  final encontrados = <Telefone>[];
  for (final trecho in texto.split(RegExp(r'[/;,]|\s{2,}| e '))) {
    final digitos = trecho.replaceAll(RegExp(r'\D'), '');
    if (digitos.length == 10 || digitos.length == 11) {
      encontrados.add(Telefone(ddd: digitos.substring(0, 2), numero: digitos.substring(2)));
    }
  }
  return encontrados;
}

/// Aceita "1.234,56" e "1234.56" (campo digitado à mão, em pt-BR). `null` =
/// vazio ou inválido (negativo também).
double? parseValorMonetario(String texto) {
  final limpo = texto.trim();
  if (limpo.isEmpty) return null;
  final normalizado = limpo.contains(',') ? limpo.replaceAll('.', '').replaceAll(',', '.') : limpo;
  final numero = double.tryParse(normalizado);
  if (numero == null || numero.isNaN || numero.isInfinite || numero < 0) return null;
  return (numero * 100).round() / 100;
}

/// Valor monetário pra exibir num campo editável ("1234,56").
String formatarValorParaCampo(double? valor) =>
    valor == null ? '' : valor.toString().replaceAll('.', ',');

bool emailEhValido(String texto) => RegExp(r'^\S+@\S+\.\S+$').hasMatch(texto.trim());
