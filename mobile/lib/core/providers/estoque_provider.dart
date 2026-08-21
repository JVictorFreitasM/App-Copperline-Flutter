import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../api_exception.dart';
import '../models/estoque.dart';

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
  const EstoqueComSaldo(this.resultado);
  final ResultadoEstoque resultado;
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
      state = erro.statusCode == 404
          ? EstoqueNaoEncontrado(identificador)
          : EstoqueErro(erro.message);
    }
  }
}

final estoqueProvider = NotifierProvider<EstoqueNotifier, EstoqueState>(EstoqueNotifier.new);
