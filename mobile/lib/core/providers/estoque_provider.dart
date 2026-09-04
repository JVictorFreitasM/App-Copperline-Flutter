import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../api_exception.dart';
import '../models/estoque.dart';
import 'offline_provider.dart';

/// Mesmos estados de `frontend/src/app/estoque/actions.ts`
/// (`ResultadoConsultaEstoque`) - busca pontual disparada por ação do
/// usuário, não um `build()` orientado a parâmetro (por isso `Notifier`
/// simples em vez de `FutureProvider.family`, ver core/providers/*
/// dos demais recursos).
sealed class EstoqueState {
  const EstoqueState();
}

class EstoqueIdle extends EstoqueState {
  const EstoqueIdle();
}

class EstoqueCarregando extends EstoqueState {
  const EstoqueCarregando();
}

class EstoqueErro extends EstoqueState {
  const EstoqueErro(this.mensagem);
  final String mensagem;
}

class EstoqueNaoEncontrado extends EstoqueState {
  const EstoqueNaoEncontrado(this.identificador);
  final String identificador;
}

class EstoqueSemSaldo extends EstoqueState {
  const EstoqueSemSaldo(this.identificador);
  final String identificador;
}

class EstoqueComSaldo extends EstoqueState {
  const EstoqueComSaldo(this.resultado, {this.offline = false});
  final ResultadoEstoque resultado;
  // true quando veio do cache local (OS-BACKEND-42) por falha de rede -
  // UI mostra aviso de "dado offline, pode estar desatualizado" (mesmo
  // atualizadoEm do resultado já indica QUANDO foi sincronizado).
  final bool offline;
}

class EstoqueNotifier extends Notifier<EstoqueState> {
  @override
  EstoqueState build() => const EstoqueIdle();

  Future<void> consultar(String identificadorBruto) async {
    final identificador = identificadorBruto.trim();
    if (identificador.isEmpty) return;

    state = const EstoqueCarregando();
    final apiClient = ref.read(apiClientProvider);
    try {
      final json = await apiClient.getJson('/estoque/${Uri.encodeComponent(identificador)}');
      final resultado = ResultadoEstoque.fromJson(json);
      state = resultado.itens.isEmpty
          ? EstoqueSemSaldo(identificador)
          : EstoqueComSaldo(resultado);
    } on ApiException catch (erro) {
      if (erro.statusCode == null) {
        // Falha de rede (sem resposta do servidor) - tenta o cache local
        // do snapshot antes de desistir (OS-BACKEND-42, gap encontrado:
        // estoque nunca tinha fallback offline, diferente de clientes/
        // produtos/pedidos).
        final estadoOffline = await _tentarCacheLocal(identificador);
        if (estadoOffline != null) {
          state = estadoOffline;
          return;
        }
      }
      state = erro.statusCode == 404
          ? EstoqueNaoEncontrado(identificador)
          : EstoqueErro(erro.message);
    }
  }

  Future<EstoqueState?> _tentarCacheLocal(String identificador) async {
    final snapshotService = await ref.read(snapshotServiceProvider.future);
    final resultado = await snapshotService.estoquePorCodigo(identificador);
    if (resultado == null) return null;
    return resultado.itens.isEmpty
        ? EstoqueSemSaldo(identificador)
        : EstoqueComSaldo(resultado, offline: true);
  }
}

final estoqueProvider = NotifierProvider<EstoqueNotifier, EstoqueState>(EstoqueNotifier.new);

/// Top 10 produtos mais pedidos (pedido do usuario, na tela de estoque) -
/// GET /estoque/mais-pedidos, sem parametro de identificador (diferente do
/// resto desta tela, que e' busca pontual) - por isso FutureProvider comum,
/// nao amarrado ao EstoqueNotifier acima.
final produtosMaisPedidosProvider = FutureProvider<List<ProdutoMaisPedido>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/estoque/mais-pedidos');
  return json.map(ProdutoMaisPedido.fromJson).toList();
});
