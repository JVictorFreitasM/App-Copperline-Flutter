// Subconjunto do ReadPedidoDto (Radar.API, GET /comercial/v1/pedido) que o
// sistema efetivamente usa - schema completo confirmado contra o
// swagger.json do ambiente de testes (ver skill wk-radar-client). Blocos
// extensos de tributos/rateios/liberacoes de estoque ficam fora (OS 07,
// "Fora de escopo").
export type SituacaoPedidoWkRadar =
  | 'EmAnalise'
  | 'Bloqueado'
  | 'Pendente'
  | 'Cancelado'
  | 'ParcialmenteFaturado'
  | 'Faturado'
  | 'ParcialmenteAtendido'
  | 'Atendido';

export type SituacaoItemPedidoWkRadar =
  | 'Nenhum'
  | 'Cancelado'
  | 'Faturado'
  | 'ParcialmenteFaturado'
  | 'Atendido'
  | 'ParcialmenteAtendido'
  | 'Pendente';

// produtoServico identifica o item pela combinacao id + idItemGrade1/2/3,
// nao so pelo id do produto base (ver skill wk-radar-client, secao
// "Sistema de grade").
export interface WkRadarProdutoServico {
  id?: string | null;
  idItemGrade1?: string | null;
  idItemGrade2?: string | null;
  idItemGrade3?: string | null;
}

export interface WkRadarPedidoItem {
  numero: number;
  produtoServico?: WkRadarProdutoServico | null;
  quantidadeVenda?: number | null;
  valorUnitario?: number | null;
  valorTotal?: number | null;
  situacao?: SituacaoItemPedidoWkRadar | null;
}

export interface WkRadarPedidoTotal {
  valorTotal?: number | null;
}

// Endereco de entrega (localEntrega) - so idMunicipio interessa aqui (UF
// derivada do codigo IBGE, ver ibgeCodigoParaUf em pedido.sync.ts); o
// resto do endereco (logradouro/bairro/cep/contato) fica fora, sem uso no
// sistema hoje. So preenchido em ~7% dos pedidos no ambiente real
// (confirmado empiricamente).
export interface WkRadarLocalEntrega {
  idMunicipio?: string | null;
}

export interface WkRadarVendedorPedido {
  id?: string | null;
}

export interface WkRadarPedido {
  id: string;
  codigoIntegrador?: string | null;
  numero?: string | null;
  situacao?: SituacaoPedidoWkRadar | null;
  dataHoraUltimaAlteracao?: string | null;
  // Formato DD/MM/YYYY (confirmado empiricamente, diferente do padrao
  // ISO de dataHoraUltimaAlteracao/dataHoraGravacao) - parse dedicado em
  // pedido.sync.ts.
  dataEmissao?: string | null;
  idCliente?: string | null;
  localEntrega?: WkRadarLocalEntrega | null;
  // So o PRIMEIRO vendedor e' usado (confirmado empiricamente: nenhum
  // pedido na amostra real teve mais de 1) - coluna "Vendedor" da
  // listagem, ver Pedido.vendedorRadarId.
  vendedores?: WkRadarVendedorPedido[] | null;
  total?: WkRadarPedidoTotal | null;
  itens?: WkRadarPedidoItem[] | null;
}

export interface PedidoItemMapeado {
  numero: number;
  produtoServicoId: string | null;
  idItemGrade1: string | null;
  idItemGrade2: string | null;
  idItemGrade3: string | null;
  quantidadeVenda: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  situacao: string | null;
}

export interface PedidoMapeado {
  idExternoErp: string;
  codigoIntegrador: string | null;
  numero: string | null;
  situacao: string | null;
  dataHoraUltimaAlteracao: Date | null;
  dataEmissao: Date | null;
  ufEntrega: string | null;
  idVendedorExterno: string | null;
  idClienteExterno: string | null;
  valorTotal: number | null;
  itens: PedidoItemMapeado[];
}
