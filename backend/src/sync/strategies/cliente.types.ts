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
}
