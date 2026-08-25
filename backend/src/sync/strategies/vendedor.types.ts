// Subconjunto do ReadVendedorDto (Radar.API, GET /empresarial/v1/vendedor)
// que o sistema efetivamente usa - schema completo confirmado contra o
// swagger.json do ambiente de testes (ver skill wk-radar-client). Campos de
// comissao (valorFixo, percentualComissaoFaturamento/Recebimento,
// pagamentoComissao*) e telefone (fone1/2, dddFone1/2) ficam fora - fora do
// escopo desta OS (so cadastro + vinculo com usuario).
export interface WkRadarVendedor {
  id: string;
  codigoIntegrador?: string | null;
  codigo?: string | null;
  nome?: string | null;
  email?: string | null;
  inativo: boolean;
}

export interface VendedorMapeado {
  idExternoErp: string;
  codigoIntegrador: string | null;
  codigo: string | null;
  nome: string | null;
  email: string | null;
  inativo: boolean;
}
