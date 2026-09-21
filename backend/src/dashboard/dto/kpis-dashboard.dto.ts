export interface OrcamentosAbertosDto {
  quantidade: number;
  valorTotal: string;
}

export interface ClientesSemPedidoRecenteDto {
  quantidade: number;
  valorPotencial: string;
  diasSemPedido: number;
}

export interface TicketMedioVendasDto {
  valor: string;
  quantidadePedidos: number;
}

export interface KpisDashboardDto {
  orcamentosAbertos: OrcamentosAbertosDto;
  clientesSemPedidoRecente: ClientesSemPedidoRecenteDto;
  ticketMedioVendas: TicketMedioVendasDto;
}
