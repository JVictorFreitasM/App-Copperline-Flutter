import type { ConsultaCnpjDto } from './dto/consulta-cnpj-response.dto';
import type { ReceitaWsAtividade, ReceitaWsResponse } from './receitaws.types';

// "00.00-0-00 / Nao informada" e o sentinel da API pra "sem atividade",
// nao uma atividade real.
const CODIGO_ATIVIDADE_NAO_INFORMADA = '00.00-0-00';

export function vazioParaNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  return texto ? texto : null;
}

function mapearAtividades(lista: ReceitaWsAtividade[] | undefined) {
  return (lista ?? [])
    .filter((atividade) => atividade.code !== CODIGO_ATIVIDADE_NAO_INFORMADA)
    .map((atividade) => ({ codigo: atividade.code, descricao: atividade.text }));
}

// Resposta da ReceitaWS -> nosso DTO. A ReceitaWS NAO devolve o codigo IBGE do
// municipio (codigoIbge fica null; quem precisa resolve pelo CEP).
export function mapearReceitaWs(dados: ReceitaWsResponse): ConsultaCnpjDto {
  return {
    cnpj: dados.cnpj ?? '',
    razaoSocial: dados.nome ?? '',
    nomeFantasia: vazioParaNull(dados.fantasia),
    tipo: vazioParaNull(dados.tipo),
    porte: vazioParaNull(dados.porte),
    naturezaJuridica: vazioParaNull(dados.natureza_juridica),
    situacao: vazioParaNull(dados.situacao),
    dataSituacao: vazioParaNull(dados.data_situacao),
    motivoSituacao: vazioParaNull(dados.motivo_situacao),
    abertura: vazioParaNull(dados.abertura),
    capitalSocial: vazioParaNull(dados.capital_social),
    atividadePrincipal: mapearAtividades(dados.atividade_principal)[0] ?? null,
    atividadesSecundarias: mapearAtividades(dados.atividades_secundarias),
    endereco: {
      logradouro: vazioParaNull(dados.logradouro),
      numero: vazioParaNull(dados.numero),
      complemento: vazioParaNull(dados.complemento),
      bairro: vazioParaNull(dados.bairro),
      municipio: vazioParaNull(dados.municipio),
      uf: vazioParaNull(dados.uf),
      cep: vazioParaNull(dados.cep),
      codigoIbge: null,
    },
    telefone: vazioParaNull(dados.telefone),
    email: vazioParaNull(dados.email),
    socios: (dados.qsa ?? []).map((socio) => ({
      nome: socio.nome,
      qualificacao: vazioParaNull(socio.qual),
    })),
    optanteSimples: dados.simples?.optante ?? null,
    optanteMei: dados.simei?.optante ?? null,
    ultimaAtualizacao: vazioParaNull(dados.ultima_atualizacao),
  };
}
