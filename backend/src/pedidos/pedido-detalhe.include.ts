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
  // "Horario do envio" (tela de detalhe) - so existe pra pedido criado
  // localmente e ja enviado ao ERP: a transicao pra ENVIADO em
  // PedidoHistoricoStatus (gravada por CriarPedidoService.
  // persistirPedidoEnviado) e' o UNICO timestamp real de "quando foi
  // enviado" que o sistema tem (sincronizadoEm tem semantica diferente -
  // "quando sincronizamos/criamos o registro", nao "quando foi enviado
  // pro Radar"). Pedido sincronizado do Radar nunca tem linha de
  // historico daqui (so' escrito pelo nosso proprio fluxo de
  // criacao/aprovacao), entao continua "-" pra esses - nunca inventado.
  historicoStatus: {
    where: { statusNovo: 'ENVIADO' },
    orderBy: { alteradoEm: 'asc' },
    take: 1,
  },
  itens: {
    include: { produto: true, decididoPor: true },
    orderBy: { numero: 'asc' },
  },
  // Notas fiscais vinculadas (N:N via NotaFiscalPedido) - pedido pode ter
  // mais de uma (faturamento parcial: fatura o que tem disponivel, emite
  // a nota, e emite outra depois pro restante quando produzir - confirmado
  // com o usuario, 2026-09-23). Usado pra exibir/baixar o PDF na tela de
  // detalhe (ver NotasFiscaisController.obterPdf).
  notasFiscais: {
    include: { notaFiscal: true },
    orderBy: { notaFiscal: { dataEmissao: 'asc' } },
  },
} satisfies Prisma.PedidoInclude;
