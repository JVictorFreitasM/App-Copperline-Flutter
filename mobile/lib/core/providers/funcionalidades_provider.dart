import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';

/// Chaves de Configurações > Funcionalidades (painel web). Só reflete o estado na
/// tela - quem recusa de verdade é o backend.
class Funcionalidades {
  const Funcionalidades({
    this.envioPedidosHabilitado = true,
    this.cadastroClientesHabilitado = true,
  });

  /// Tudo ligado: valor usado enquanto carrega ou sem rede (o app nunca esconde
  /// nada por não conseguir consultar; o backend decide no envio).
  static const padrao = Funcionalidades();

  final bool envioPedidosHabilitado;
  final bool cadastroClientesHabilitado;

  factory Funcionalidades.fromJson(Map<String, dynamic> json) =>
      Funcionalidades(
        envioPedidosHabilitado: json['envioPedidosHabilitado'] as bool? ?? true,
        cadastroClientesHabilitado:
            json['cadastroClientesHabilitado'] as bool? ?? true,
      );
}

final funcionalidadesProvider = FutureProvider<Funcionalidades>((ref) async {
  try {
    final json = await ref
        .watch(apiClientProvider)
        .getJson('/configuracoes/funcionalidades');
    return Funcionalidades.fromJson(json);
  } catch (_) {
    return Funcionalidades.padrao;
  }
});
