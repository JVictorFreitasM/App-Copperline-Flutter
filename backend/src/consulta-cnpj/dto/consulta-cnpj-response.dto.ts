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
  // Codigo IBGE do municipio - so a BrasilAPI informa; na ReceitaWS fica null
  // e o IBGE vem pela API de CEP.
  codigoIbge: string | null;
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

// De onde veio a resposta - util pra medir quantas consultas economizamos.
export type OrigemConsultaCnpj = 'BASE' | 'CACHE' | 'API';

// CNPJ que ja existe na base da empresa - a consulta NAO vai ao provedor
// externo (so o suficiente pra tela avisar quem cuida do cliente).
export interface ClienteJaCadastradoDto {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  vendedorResponsavel: string | null;
  statusEnvioErp: 'PENDENTE' | 'ENVIADO' | 'ERRO';
}

// Endereco pronto pra preencher o cadastro: dado da Receita + IBGE (da API de
// CEP) + id do municipio no WK Radar (o POST /cliente exige esse id).
export interface EnderecoSugeridoDto {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  semNumero: boolean;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  codigoIbge: string | null;
  idMunicipioErp: string | null;
}

export interface ConsultaCnpjResultadoDto {
  cnpj: string;
  origem: OrigemConsultaCnpj;
  jaCadastrado: ClienteJaCadastradoDto | null;
  // null quando origem = BASE (nao foi consultada a Receita).
  dados: ConsultaCnpjDto | null;
  enderecoSugerido: EnderecoSugeridoDto | null;
  // Texto pronto pro campo Observacoes (situacao, abertura, atividades).
  observacoesSugeridas: string | null;
}
