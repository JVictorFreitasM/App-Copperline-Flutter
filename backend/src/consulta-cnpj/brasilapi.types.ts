// Subconjunto de GET https://brasilapi.com.br/api/cnpj/v1/{cnpj} (confirmado em
// teste real, 2026-10-06). Diferente da ReceitaWS, devolve o codigo IBGE do
// municipio (`codigo_municipio_ibge`) e nao tem limite apertado por minuto.
export interface BrasilApiCnae {
  codigo: number;
  descricao: string;
}

export interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  descricao_identificador_matriz_filial?: string | null;
  porte?: string | null;
  natureza_juridica?: string | null;
  descricao_situacao_cadastral?: string | null;
  data_situacao_cadastral?: string | null;
  descricao_motivo_situacao_cadastral?: string | null;
  data_inicio_atividade?: string | null;
  capital_social?: number | null;
  cnae_fiscal?: number | null;
  cnae_fiscal_descricao?: string | null;
  cnaes_secundarios?: BrasilApiCnae[] | null;
  descricao_tipo_de_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  codigo_municipio_ibge?: number | null;
  ddd_telefone_1?: string | null;
  email?: string | null;
  qsa?: { nome_socio: string; qualificacao_socio?: string | null }[] | null;
  opcao_pelo_simples?: boolean | null;
  opcao_pelo_mei?: boolean | null;
}
