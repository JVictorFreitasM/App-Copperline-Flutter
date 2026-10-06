// Mesmo shape de backend/src/consulta-cnpj/dto/consulta-cnpj-response.dto.ts
// (GET /consulta-cnpj/:cnpj) - duplicado aqui por não haver pacote
// compartilhado entre front e back.
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

// Validação de CNPJ (numérico e alfanumérico) no navegador/Server Action
// ANTES de qualquer chamada à API - feedback imediato e economia de
// requisição do provedor externo. Espelha
// backend/src/consulta-cnpj/domain/cnpj.ts (o backend valida de novo, o
// front não é confiável).
const PESOS_PRIMEIRO_DV = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DV = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizarCnpj(entrada: string): string {
  return entrada.replace(/[.\-/\s]/g, "").toUpperCase();
}

function calcularDigito(base: string, pesos: number[]): number {
  const soma = [...base].reduce(
    (acumulado, caractere, indice) => acumulado + (caractere.charCodeAt(0) - 48) * pesos[indice],
    0,
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjEhValido(entrada: string): boolean {
  const cnpj = normalizarCnpj(entrada);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) {
    return false;
  }
  const primeiroDv = calcularDigito(cnpj.slice(0, 12), PESOS_PRIMEIRO_DV);
  const segundoDv = calcularDigito(cnpj.slice(0, 13), PESOS_SEGUNDO_DV);
  return cnpj.endsWith(`${primeiroDv}${segundoDv}`);
}

// Máscara de exibição "XX.XXX.XXX/XXXX-XX" - o que a Receita mostra.
export function formatarCnpj(entrada: string): string {
  const cnpj = normalizarCnpj(entrada);
  if (cnpj.length !== 14) {
    return entrada;
  }
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

// ---- Resposta do GET /consulta-cnpj/:cnpj (backend: ConsultaCnpjResultadoDto)
// O backend NAO consulta a Receita quando o CNPJ ja esta na base (origem BASE,
// dados null) nem quando ha cache (origem CACHE).
export type OrigemConsultaCnpj = "BASE" | "CACHE" | "API";

export interface ClienteJaCadastradoDto {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  vendedorResponsavel: string | null;
  statusEnvioErp: "PENDENTE" | "ENVIADO" | "ERRO";
}

// Endereço pronto pro cadastro: Receita + IBGE (API de CEP) + id do município
// no WK Radar.
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
  dados: ConsultaCnpjDto | null;
  enderecoSugerido: EnderecoSugeridoDto | null;
  observacoesSugeridas: string | null;
}
