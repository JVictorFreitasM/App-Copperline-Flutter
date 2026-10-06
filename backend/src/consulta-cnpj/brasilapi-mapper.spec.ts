import { mapearBrasilApi } from './brasilapi-mapper';
import type { BrasilApiCnpjResponse } from './brasilapi.types';

// Recorte da resposta REAL da BrasilAPI para o CNPJ 00.000.000/0001-91
// (2026-10-06).
const BANCO_DO_BRASIL: BrasilApiCnpjResponse = {
  cnpj: '00000000000191',
  razao_social: 'BANCO DO BRASIL SA',
  nome_fantasia: 'DIRECAO GERAL',
  descricao_identificador_matriz_filial: 'MATRIZ',
  porte: 'DEMAIS',
  natureza_juridica: 'Sociedade de Economia Mista',
  descricao_situacao_cadastral: 'ATIVA',
  data_situacao_cadastral: '2005-11-03',
  descricao_motivo_situacao_cadastral: 'SEM MOTIVO',
  data_inicio_atividade: '1966-08-01',
  capital_social: 120000000000,
  cnae_fiscal: 6422100,
  cnae_fiscal_descricao: 'Bancos múltiplos, com carteira comercial',
  cnaes_secundarios: [
    { codigo: 6499999, descricao: 'Outras atividades de serviços financeiros' },
    { codigo: 0, descricao: 'Não informada' },
  ],
  descricao_tipo_de_logradouro: 'QUADRA',
  logradouro: 'SAUN QUADRA 5 BLOCO B TORRE I, II, III',
  numero: 'SN',
  complemento: 'ANDAR T I SL S101',
  bairro: 'ASA NORTE',
  municipio: 'BRASILIA',
  uf: 'DF',
  cep: '70040912',
  codigo_municipio_ibge: 5300108,
  ddd_telefone_1: '6134939002',
  email: null,
  qsa: [{ nome_socio: 'ALAN CARLOS', qualificacao_socio: 'Diretor' }],
  opcao_pelo_simples: false,
  opcao_pelo_mei: false,
};

describe('mapearBrasilApi', () => {
  it('traz o codigo IBGE do municipio (a ReceitaWS nao traz)', () => {
    expect(mapearBrasilApi(BANCO_DO_BRASIL).endereco.codigoIbge).toBe('5300108');
  });

  it('converte datas ISO pro formato BR da ReceitaWS', () => {
    const dto = mapearBrasilApi(BANCO_DO_BRASIL);

    expect(dto.abertura).toBe('01/08/1966');
    expect(dto.dataSituacao).toBe('03/11/2005');
  });

  it('formata o CNAE como a ReceitaWS (NN.NN-N-NN) e descarta o CNAE zerado', () => {
    const dto = mapearBrasilApi(BANCO_DO_BRASIL);

    expect(dto.atividadePrincipal).toEqual({
      codigo: '64.22-1-00',
      descricao: 'Bancos múltiplos, com carteira comercial',
    });
    expect(dto.atividadesSecundarias).toEqual([
      { codigo: '64.99-9-99', descricao: 'Outras atividades de serviços financeiros' },
    ]);
  });

  it('capital social como string com 2 casas e telefone no formato (DD) NNNN-NNNN', () => {
    const dto = mapearBrasilApi(BANCO_DO_BRASIL);

    expect(dto.capitalSocial).toBe('120000000000.00');
    expect(dto.telefone).toBe('(61) 3493-9002');
  });

  it('prefixa o tipo do logradouro so quando o nome ainda nao o contem', () => {
    expect(
      mapearBrasilApi({ ...BANCO_DO_BRASIL, descricao_tipo_de_logradouro: 'AVENIDA', logradouro: 'PAULISTA' })
        .endereco.logradouro,
    ).toBe('AVENIDA PAULISTA');
    expect(
      mapearBrasilApi({ ...BANCO_DO_BRASIL, descricao_tipo_de_logradouro: 'QUADRA', logradouro: 'QUADRA 5' })
        .endereco.logradouro,
    ).toBe('QUADRA 5');
  });

  it('mapeia situacao, socios e opcoes tributarias; vazio vira null', () => {
    const dto = mapearBrasilApi({ ...BANCO_DO_BRASIL, nome_fantasia: '', email: '  ' });

    expect(dto).toMatchObject({
      razaoSocial: 'BANCO DO BRASIL SA',
      situacao: 'ATIVA',
      tipo: 'MATRIZ',
      nomeFantasia: null,
      email: null,
      optanteSimples: false,
      optanteMei: false,
      socios: [{ nome: 'ALAN CARLOS', qualificacao: 'Diretor' }],
    });
  });

  it('IBGE ausente vira null (cai na consulta de CEP)', () => {
    expect(
      mapearBrasilApi({ ...BANCO_DO_BRASIL, codigo_municipio_ibge: null }).endereco.codigoIbge,
    ).toBeNull();
  });
});
