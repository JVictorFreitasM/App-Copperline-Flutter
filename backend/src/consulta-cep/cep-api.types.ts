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

export interface CepApiResponse {
  success: boolean;
  message: string | null;
  data: CepApiData | null;
}
