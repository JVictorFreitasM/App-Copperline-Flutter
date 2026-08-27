import 'package:flutter_test/flutter_test.dart';
import 'package:copperline_mobile/core/push/push_config.dart';
import 'package:copperline_mobile/core/push/push_navigation.dart';

// Discriminador de tipo de notificacao pela chave presente no payload
// (OS-MOBILE-16) - o backend nao envia `tipo` no data payload (ver
// comentario em push_navigation.dart), entao esse mapeamento e' a unica
// forma de saber qual categoria uma notificacao pertence.
void main() {
  group('categoriaDoPayload', () {
    test('pedidoId mapeia pra categoria pedidos', () {
      expect(categoriaDoPayload({'pedidoId': 'p1'}), CategoriaNotificacao.pedidos);
    });

    test('produtoId mapeia pra categoria estoque', () {
      expect(
        categoriaDoPayload({'produtoId': 'x1', 'codigoProduto': 'COD-1'}),
        CategoriaNotificacao.estoque,
      );
    });

    test('notaFiscalId mapeia pra categoria notasFiscais', () {
      expect(categoriaDoPayload({'notaFiscalId': 'n1'}), CategoriaNotificacao.notasFiscais);
    });

    test('visitaId mapeia pra categoria visitasEquipe', () {
      expect(
        categoriaDoPayload({'visitaId': 'v1', 'vendedorId': 'vend1'}),
        CategoriaNotificacao.visitasEquipe,
      );
    });

    test('payload sem nenhuma chave conhecida retorna null', () {
      expect(categoriaDoPayload({'algumaCoisa': 'x'}), isNull);
    });

    test('pedidoId tem prioridade quando (hipoteticamente) mais de uma chave presente', () {
      expect(
        categoriaDoPayload({'pedidoId': 'p1', 'produtoId': 'x1'}),
        CategoriaNotificacao.pedidos,
      );
    });
  });
}
