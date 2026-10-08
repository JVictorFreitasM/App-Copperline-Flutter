import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Notas ("o que há de novo") de uma versão do app. Guardadas NO APARELHO no
/// momento em que o usuário atualiza: depois da atualização o app abre já
/// sabendo as notas da versão que está rodando, sem precisar de rede.
class NotasVersao {
  const NotasVersao({required this.versionCode, required this.versionName, required this.notas});

  factory NotasVersao.fromJson(Map<String, dynamic> json) => NotasVersao(
    versionCode: json['versionCode'] as int,
    versionName: json['versionName'] as String,
    notas: json['notas'] as String? ?? '',
  );

  final int versionCode;
  final String versionName;
  final String notas;

  Map<String, dynamic> toJson() => {
    'versionCode': versionCode,
    'versionName': versionName,
    'notas': notas,
  };

  bool get temTexto => notas.trim().isNotEmpty;
}

/// Persistência local (SharedPreferences) das notas da última atualização e de
/// qual versão já teve suas novidades mostradas (o aviso aparece uma vez só).
class NotasVersaoStore {
  static const _chaveNotas = 'atualizacao.notas_da_versao';
  static const _chaveVistas = 'atualizacao.novidades_vistas_ate';

  Future<void> salvar(NotasVersao notas) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_chaveNotas, jsonEncode(notas.toJson()));
  }

  Future<NotasVersao?> ler() async {
    final prefs = await SharedPreferences.getInstance();
    final bruto = prefs.getString(_chaveNotas);
    if (bruto == null) return null;
    try {
      return NotasVersao.fromJson(jsonDecode(bruto) as Map<String, dynamic>);
    } catch (_) {
      // Valor corrompido: ignora, nunca derruba o app por causa de nota.
      return null;
    }
  }

  Future<int> versaoJaVista() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_chaveVistas) ?? 0;
  }

  Future<void> marcarComoVista(int versionCode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_chaveVistas, versionCode);
  }
}
