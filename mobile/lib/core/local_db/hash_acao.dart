import 'dart:convert';
import 'package:crypto/crypto.dart';

/// JSON canônico (chaves em ordem, sem espaços, número inteiro sem ".0") -
/// MESMO algoritmo de `backend/src/mobile/hash-acao.ts` (jsonCanonico):
/// app e servidor precisam chegar ao mesmo hash de uma ação da fila offline
/// pro ACK funcionar. Mudou aqui, muda lá (os dois testes de paridade usam o
/// mesmo hash de referência).
String jsonCanonico(Object? valor) {
  if (valor == null) return 'null';
  if (valor is bool) return '$valor';
  if (valor is num) {
    // 30.0 viaja como "30.0" no JSON do app mas o servidor lê 30 - os dois
    // lados normalizam número integral pra inteiro.
    if (valor is double &&
        valor.isFinite &&
        valor == valor.truncateToDouble() &&
        valor.abs() < 1e15) {
      return valor.toInt().toString();
    }
    return valor.toString();
  }
  if (valor is String) return jsonEncode(valor);
  if (valor is List) return '[${valor.map(jsonCanonico).join(',')}]';
  if (valor is Map) {
    final chaves = valor.keys.cast<String>().toList()..sort();
    return '{${chaves.map((k) => '${jsonEncode(k)}:${jsonCanonico(valor[k])}').join(',')}}';
  }
  throw ArgumentError('Tipo não serializável no hash da ação: ${valor.runtimeType}');
}

/// SHA-256 (hex) de {idLocal, tipo, timestamp, payload} em JSON canônico.
String hashDaAcao({
  required String idLocal,
  required String tipo,
  required String timestamp,
  required Map<String, dynamic> payload,
}) {
  final canonico = jsonCanonico({
    'idLocal': idLocal,
    'tipo': tipo,
    'timestamp': timestamp,
    'payload': payload,
  });
  return sha256.convert(utf8.encode(canonico)).toString();
}
