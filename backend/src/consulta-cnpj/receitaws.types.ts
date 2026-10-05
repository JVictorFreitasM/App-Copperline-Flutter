// Shape cru de GET https://receitaws.com.br/v1/cnpj/{cnpj} (confirmado em
// teste real, 2026-10-05). Em erro de negocio a API responde 200 com
// status "ERROR" e `message`.
export interface ReceitaWsAtividade {
  code: string;
  text: string;
}

export interface ReceitaWsOptante {
  optante: boolean | null;
}

export interface ReceitaWsResponse {
  status: 'OK' | 'ERROR';
  message?: string;
  cnpj?: string;
  nome?: string;
  fantasia?: string;
  tipo?: string;
  porte?: string;
  natureza_juridica?: string;
  situacao?: string;
  data_situacao?: string;
  motivo_situacao?: string;
  abertura?: string;
  capital_social?: string;
  atividade_principal?: ReceitaWsAtividade[];
  atividades_secundarias?: ReceitaWsAtividade[];
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  qsa?: { nome: string; qual?: string }[];
  simples?: ReceitaWsOptante;
  simei?: ReceitaWsOptante;
  ultima_atualizacao?: string;
}
