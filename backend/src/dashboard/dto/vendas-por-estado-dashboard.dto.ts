export interface VendasPorEstadoDto {
  uf: string;
  valorTotal: string;
  quantidadePedidos: number;
}

export interface VendasPorEstadoDashboardDto {
  periodo: { dataInicial: string | null; dataFinal: string | null };
  estados: VendasPorEstadoDto[];
  // Pedido.ufEntrega so' vem preenchido pra ~7% dos pedidos (derivado do
  // idMunicipio do Radar, ver schema.prisma) - exposto explicitamente aqui
  // pra tela nunca fingir que o grafico cobre 100% dos pedidos do periodo.
  quantidadePedidosSemUf: number;
}
