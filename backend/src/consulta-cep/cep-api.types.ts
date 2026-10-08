// Shape cru de GET https://mileena.opencaramelo.com/cep/{cep} (confirmado
// em teste real, 2026-10-06). Erro de negocio vem com `success: false`,
// `message` e `data: null` (404 nao encontrado, 400 formato invalido).
export interface CepApiData {
  cep: string;
  cepFormatado: string;
  uf: string;
  nomeLocalidade: string;
  nomeBairro: string;
  tipoLogradouro: string;
  nomeLogradouro: string;
  complementoLogradouro: string;
  unidade: string;
  codigoIbge: string;
}

// Shape de GET https://viacep.com.br/ws/{cep}/json/ - CEP inexistente volta 200 com
// `{ "erro": true }`.
export interface ViaCepResponse {
  erro?: boolean | string;
  logradouro?: string;
  complemento?: string;
  unidade?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
}

export interface CepApiResponse {
  success: boolean;
  message: string | null;
  data: CepApiData | null;
}
