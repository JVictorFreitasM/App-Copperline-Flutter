import type { Prisma } from '../../generated/prisma/client';

// Include compartilhado entre PedidosService.buscarPorId e os metodos de
// aprovacao por item (aprovarItem/rejeitarItem/aprovarTodosItens/
// rejeitarTodosItens) - todos devolvem o MESMO shape de PedidoDetalheDto
// (ver pedido-response.dto.ts), entao usam o mesmo include em vez de
// repetir a arvore cliente.contatos/itens.produto/itens.decididoPor em
// cada query.
export const PEDIDO_DETALHE_INCLUDE = {
  cliente: { include: { contatos: true } },
  // Dois conceitos de vendedor DIFERENTES (ver comentario em
  // Pedido.vendedorId/vendedorRadarId, schema.prisma): vendedor = quem o
  // pedido pertence quando criado por este sistema (POST /pedidos, pode
  // ser em nome de outro vendedor da equipe); vendedorRadar = vendedor do
  // proprio pedido SINCRONIZADO do Radar. So' um dos dois fica preenchido
  // por vez, conforme a origem do pedido - ambos inclusos pra
  // paraPedidoDetalheDto decidir qual exibir.
  vendedor: true,
  vendedorRadar: true,
  formaPagamento: true,
  condicaoPagamento: true,
  contato: true,
  itens: {
    include: { produto: true, decididoPor: true },
    orderBy: { numero: 'asc' },
  },
} satisfies Prisma.PedidoInclude;
