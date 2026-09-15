import type { Prisma } from '../../generated/prisma/client';

// Include compartilhado entre PedidosService.buscarPorId e os metodos de
// aprovacao por item (aprovarItem/rejeitarItem/aprovarTodosItens/
// rejeitarTodosItens) - todos devolvem o MESMO shape de PedidoDetalheDto
// (ver pedido-response.dto.ts), entao usam o mesmo include em vez de
// repetir a arvore cliente.contatos/itens.produto/itens.decididoPor em
// cada query.
export const PEDIDO_DETALHE_INCLUDE = {
  cliente: { include: { contatos: true } },
  itens: {
    include: { produto: true, decididoPor: true },
    orderBy: { numero: 'asc' },
  },
} satisfies Prisma.PedidoInclude;
