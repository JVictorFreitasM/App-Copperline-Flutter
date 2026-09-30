import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/oportunidade.dart';

// Mesmo default do backend (OportunidadesController) - "sem pedido há pelo
// menos 45 dias" como limiar padrão pra SEM_PEDIDO_HA_DIAS.
const limiarDiasSemPedidoPadrao = 45;

/// GET /vendedores/:id/oportunidades (mesma regra de escopo de
/// meta-progresso: admin vê qualquer um, supervisor vê a equipe, vendedor
/// comum só a si mesmo). Mobile v1 sempre busca a própria carteira (sem
/// seletor de vendedor da equipe, diferente do web `/oportunidades`) -
/// cobre o caso mais comum (vendedor comum, sem equipe) e reduz o escopo
/// inicial; seletor de equipe fica pra uma extensão futura se pedido.
final oportunidadesProvider = FutureProvider.family<List<OportunidadeCliente>, String>((
  ref,
  vendedorId,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList(
    '/vendedores/${Uri.encodeComponent(vendedorId)}/oportunidades'
    '?limiarDiasSemPedido=$limiarDiasSemPedidoPadrao',
  );
  return json.map(OportunidadeCliente.fromJson).toList();
});
