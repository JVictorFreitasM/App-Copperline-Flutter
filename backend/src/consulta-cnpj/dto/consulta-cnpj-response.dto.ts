export interface AtividadeCnpjDto {
  codigo: string;
  descricao: string;
}

export interface SocioCnpjDto {
  nome: string;
  qualificacao: string | null;
}

export interface EnderecoCnpjDto {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
}

// Dados cadastrais da Receita Federal (via ReceitaWS) normalizados pro
// nosso formato - o front nunca ve o shape cru do provedor.
export interface ConsultaCnpjDto {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  tipo: string | null;
  porte: string | null;
  naturezaJuridica: string | null;
  situacao: string | null;
  dataSituacao: string | null;
  motivoSituacao: string | null;
  abertura: string | null;
  capitalSocial: string | null;
  atividadePrincipal: AtividadeCnpjDto | null;
  atividadesSecundarias: AtividadeCnpjDto[];
  endereco: EnderecoCnpjDto;
  telefone: string | null;
  email: string | null;
  socios: SocioCnpjDto[];
  optanteSimples: boolean | null;
  optanteMei: boolean | null;
  ultimaAtualizacao: string | null;
}
