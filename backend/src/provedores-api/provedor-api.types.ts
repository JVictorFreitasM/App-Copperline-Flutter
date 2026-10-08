export type TipoProvedorApi = 'CEP' | 'CNPJ' | 'GEOCODIFICACAO';

// "Formato" = qual adaptador sabe ler a resposta do provedor. Cada endpoint
// cadastrado no painel precisa falar um destes formatos (um mirror da mesma API,
// um plano pago com outra URL/token, ou uma API compativel); um servico com
// resposta diferente exige um adaptador novo no codigo.
export const FORMATOS_POR_TIPO: Record<TipoProvedorApi, readonly string[]> = {
  CEP: ['MILEENA', 'VIACEP'],
  CNPJ: ['RECEITAWS', 'BRASILAPI'],
  GEOCODIFICACAO: ['NOMINATIM'],
};

export const TIPOS_PROVEDOR_API = Object.keys(FORMATOS_POR_TIPO) as TipoProvedorApi[];

// Provedor pronto para uso (token ja decifrado) - so' circula dentro do backend.
export interface ProvedorApiAtivo {
  id: string;
  tipo: TipoProvedorApi;
  formato: string;
  rotulo: string;
  urlBase: string;
  token: string | null;
  limiteRequisicoes: number | null;
  janelaSegundos: number | null;
}

// O que o painel enxerga: o token nunca sai, so' se existe.
export interface ProvedorApiDto {
  id: string;
  tipo: TipoProvedorApi;
  formato: string;
  rotulo: string;
  urlBase: string;
  tokenDefinido: boolean;
  limiteRequisicoes: number | null;
  janelaSegundos: number | null;
  ordem: number;
  ativa: boolean;
}
