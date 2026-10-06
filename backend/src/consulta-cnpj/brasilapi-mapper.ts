import type { BrasilApiCnpjResponse } from './brasilapi.types';
import type { ConsultaCnpjDto } from './dto/consulta-cnpj-response.dto';
import { vazioParaNull } from './receitaws-mapper';

// "2005-11-03" -> "03/11/2005" (formato que a ReceitaWS usa e a tela exibe).
function dataBr(iso: string | null | undefined): string | null {
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return correspondencia
    ? `${correspondencia[3]}/${correspondencia[2]}/${correspondencia[1]}`
    : null;
}

// 6422100 -> "64.22-1-00" (mesmo formato de codigo CNAE da ReceitaWS).
function codigoCnae(codigo: number | null | undefined): string | null {
  const digitos = String(codigo ?? '').padStart(7, '0');
  if (!codigo || digitos === '0000000') {
    return null;
  }
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 4)}-${digitos[4]}-${digitos.slice(5)}`;
}

// "6134939002" -> "(61) 3493-9002".
function telefone(ddd_telefone: string | null | undefined): string | null {
  const digitos = (ddd_telefone ?? '').replace(/\D/g, '');
  if (digitos.length !== 10 && digitos.length !== 11) {
    return null;
  }
  const numero = digitos.slice(2);
  return `(${digitos.slice(0, 2)}) ${numero.slice(0, numero.length - 4)}-${numero.slice(-4)}`;
}

// "AVENIDA" + "PAULISTA" -> "AVENIDA PAULISTA", sem duplicar o tipo quando o
// logradouro ja comeca com ele.
function logradouro(tipo: string | null | undefined, nome: string | null | undefined) {
  const nomeLimpo = vazioParaNull(nome);
  const tipoLimpo = vazioParaNull(tipo);
  if (!nomeLimpo) {
    return null;
  }
  return tipoLimpo && !nomeLimpo.toUpperCase().startsWith(tipoLimpo.toUpperCase())
    ? `${tipoLimpo} ${nomeLimpo}`
    : nomeLimpo;
}

// Resposta da BrasilAPI -> o MESMO DTO da ReceitaWS: o resto do sistema nao
// distingue qual provedor respondeu.
export function mapearBrasilApi(dados: BrasilApiCnpjResponse): ConsultaCnpjDto {
  const principal = codigoCnae(dados.cnae_fiscal);
  return {
    cnpj: dados.cnpj,
    razaoSocial: dados.razao_social ?? '',
    nomeFantasia: vazioParaNull(dados.nome_fantasia),
    tipo: vazioParaNull(dados.descricao_identificador_matriz_filial),
    porte: vazioParaNull(dados.porte),
    naturezaJuridica: vazioParaNull(dados.natureza_juridica),
    situacao: vazioParaNull(dados.descricao_situacao_cadastral),
    dataSituacao: dataBr(dados.data_situacao_cadastral),
    motivoSituacao: vazioParaNull(dados.descricao_motivo_situacao_cadastral),
    abertura: dataBr(dados.data_inicio_atividade),
    capitalSocial:
      dados.capital_social === null || dados.capital_social === undefined
        ? null
        : dados.capital_social.toFixed(2),
    atividadePrincipal:
      principal && dados.cnae_fiscal_descricao
        ? { codigo: principal, descricao: dados.cnae_fiscal_descricao }
        : null,
    atividadesSecundarias: (dados.cnaes_secundarios ?? [])
      .map((cnae) => ({ codigo: codigoCnae(cnae.codigo), descricao: cnae.descricao }))
      .filter((cnae): cnae is { codigo: string; descricao: string } => cnae.codigo !== null),
    endereco: {
      logradouro: logradouro(dados.descricao_tipo_de_logradouro, dados.logradouro),
      numero: vazioParaNull(dados.numero),
      complemento: vazioParaNull(dados.complemento),
      bairro: vazioParaNull(dados.bairro),
      municipio: vazioParaNull(dados.municipio),
      uf: vazioParaNull(dados.uf),
      cep: vazioParaNull(dados.cep),
      codigoIbge: dados.codigo_municipio_ibge ? String(dados.codigo_municipio_ibge) : null,
    },
    telefone: telefone(dados.ddd_telefone_1),
    email: vazioParaNull(dados.email),
    socios: (dados.qsa ?? []).map((socio) => ({
      nome: socio.nome_socio,
      qualificacao: vazioParaNull(socio.qualificacao_socio),
    })),
    optanteSimples: dados.opcao_pelo_simples ?? null,
    optanteMei: dados.opcao_pelo_mei ?? null,
    ultimaAtualizacao: null,
  };
}
