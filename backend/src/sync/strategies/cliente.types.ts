// Subconjunto do ReadClienteDto/ReadContatoDto (Radar.API, GET
// /empresarial/v1/cliente) que o sistema efetivamente usa - schema completo
// confirmado contra o swagger.json do ambiente de testes (ver skill
// wk-radar-client).
export interface WkRadarEndereco {
  tipo?: unknown;
  cep?: string | null;
  nomeEndereco?: string | null;
  numero?: number;
  complemento?: string | null;
  bairro?: string | null;
  idMunicipio?: string | null;
  uf?: string | null;
  [campo: string]: unknown;
}

export interface WkRadarContato {
  id: string;
  codigoIntegrador?: string | null;
  nome?: string | null;
  email?: string | null;
  funcao?: string | null;
  telefoneDDD?: string | null;
  telefoneNumero?: string | null;
}

// detalhes.idVendedores: ARRAY (confirmado contra o swagger.json do
// ambiente de testes) - um cliente pode ter mais de um vendedor vinculado
// (OS-BACKEND-23, ver comentario em schema.prisma, model ClienteVendedor).
// idRepresentantes existe no mesmo bloco mas fica fora do escopo desta OS
// (so vendedor foi pedido).
export interface WkRadarClienteDetalhes {
  idVendedores?: string[] | null;
}

// Subconjunto de ReadClienteInformacoesFinanceirasDto - so limiteCredito e'
// pedido pela OS-BACKEND-36 (descontoFinanceiro/desconto ficam fora de
// escopo, ver comentario em schema.prisma).
export interface WkRadarClienteInformacoesFinanceiras {
  limiteCredito?: number | null;
  dataLimiteCredito?: string | null;
}

// idTabelaPrecoProduto (achado em 2026-09-17, schema real confirmado pelo
// usuario) - tabela de preco NATIVA do cadastro do cliente no Radar,
// separada da associacao manual admin (ClienteTabelaPreco). Os demais
// campos deste bloco (idFormaPagamento/idCondicaoPagamento/idClassificacao/
// descontoComercial) existem no schema real mas ficam FORA de escopo por
// ora - nao pedidos, nao mapeados.
export interface WkRadarClienteInformacoesExtras2 {
  idTabelaPrecoProduto?: string | null;
}

export interface WkRadarCliente {
  id: string;
  codigoIntegrador?: string | null;
  cpfCnpj?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  inativo: boolean;
  enderecos?: WkRadarEndereco[] | null;
  contatos?: WkRadarContato[] | null;
  detalhes?: WkRadarClienteDetalhes | null;
  informacoesFinanceiras?: WkRadarClienteInformacoesFinanceiras | null;
  informacoesExtras2?: WkRadarClienteInformacoesExtras2 | null;
}

export interface ContatoMapeado {
  idExternoErp: string;
  codigoIntegrador: string | null;
  nome: string | null;
  email: string | null;
  telefoneDdd: string | null;
  telefoneNumero: string | null;
  funcao: string | null;
}

export interface ClienteMapeado {
  idExternoErp: string;
  codigoIntegrador: string | null;
  cpfCnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inativo: boolean;
  enderecos: WkRadarEndereco[];
  contatos: ContatoMapeado[];
  vendedoresExternoIds: string[];
  limiteCredito: number | null;
  dataLimiteCredito: Date | null;
  tabelaPrecoIdExterno: string | null;
}
