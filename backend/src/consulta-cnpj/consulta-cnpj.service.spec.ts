import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { ConsultaCnpjDto } from './dto/consulta-cnpj-response.dto';
import { ConsultaCnpjService } from './consulta-cnpj.service';
import type { EntradaCache } from './consulta-cnpj-cache.service';
import type { ReceitaWsResponse } from './receitaws.types';

const CNPJ = '07127994000150';

const RESPOSTA: ReceitaWsResponse = {
  status: 'OK',
  cnpj: '07.127.994/0001-50',
  nome: 'MEGA FIOS LTDA',
  fantasia: '',
  situacao: 'ATIVA',
  abertura: '10/12/2004',
  capital_social: '400000.00',
  logradouro: 'AV DEPUTADO PAULO FERRAZ',
  numero: '5250',
  bairro: 'LIVRAMENTO',
  municipio: 'TERESINA',
  uf: 'PI',
  cep: '64.076-130',
  atividade_principal: [{ code: '27.33-3-00', text: 'Fabricacao de fios' }],
  atividades_secundarias: [{ code: '00.00-0-00', text: 'Nao informada' }],
  qsa: [{ nome: 'FULANO', qual: '49-Socio-Administrador' }],
  simples: { optante: false },
};

function dadosDaBrasilApi(codigoIbge: string | null = '2211001'): ConsultaCnpjDto {
  return {
    cnpj: CNPJ,
    razaoSocial: 'MEGA FIOS LTDA (BRASILAPI)',
    nomeFantasia: null,
    tipo: 'MATRIZ',
    porte: 'DEMAIS',
    naturezaJuridica: null,
    situacao: 'ATIVA',
    dataSituacao: null,
    motivoSituacao: null,
    abertura: '10/12/2004',
    capitalSocial: '400000.00',
    atividadePrincipal: { codigo: '27.33-3-00', descricao: 'Fabricacao de fios' },
    atividadesSecundarias: [],
    endereco: {
      logradouro: 'AVENIDA DEPUTADO PAULO FERRAZ',
      numero: '5250',
      complemento: null,
      bairro: 'LIVRAMENTO',
      municipio: 'TERESINA',
      uf: 'PI',
      cep: '64076130',
      codigoIbge,
    },
    telefone: null,
    email: null,
    socios: [],
    optanteSimples: false,
    optanteMei: false,
    ultimaAtualizacao: null,
  };
}

function montar() {
  const prisma = { cliente: { findFirst: jest.fn().mockResolvedValue(null) } };
  const receitaWsClient = { consultar: jest.fn().mockResolvedValue(RESPOSTA) };
  const brasilApiClient = { consultar: jest.fn().mockResolvedValue(dadosDaBrasilApi()) };
  const cache = {
    obter: jest.fn<Promise<EntradaCache | null>, [string]>().mockResolvedValue(null),
    guardar: jest.fn().mockResolvedValue(undefined),
    guardarNaoEncontrado: jest.fn().mockResolvedValue(undefined),
    guardarFalha: jest.fn().mockResolvedValue(undefined),
    tentarLock: jest.fn().mockResolvedValue(true),
    liberarLock: jest.fn().mockResolvedValue(undefined),
  };
  const orcamento = {
    tentarReservar: jest.fn().mockResolvedValue(true),
    bloquear: jest.fn().mockResolvedValue(undefined),
  };
  const consultaCepService = {
    consultar: jest.fn().mockResolvedValue({ codigoIbge: '2211001', logradouro: 'Avenida X' }),
  };
  const municipioWkService = { idPorCodigoIbge: jest.fn().mockResolvedValue('52002816') };
  // Cadeia padrao: ReceitaWS (3 por minuto) e BrasilAPI de reserva.
  const provedores = {
    cadeia: jest.fn().mockResolvedValue([
      { id: 'receitaws-id', formato: 'RECEITAWS', rotulo: 'ReceitaWS', urlBase: 'https://r.exemplo', token: 'tok', limiteRequisicoes: 3, janelaSegundos: 60 },
      { id: 'brasilapi-id', formato: 'BRASILAPI', rotulo: 'BrasilAPI', urlBase: 'https://b.exemplo', token: null, limiteRequisicoes: null, janelaSegundos: null },
    ]),
  };
  const service = new ConsultaCnpjService(
    prisma as never,
    receitaWsClient as never,
    brasilApiClient as never,
    cache as never,
    orcamento as never,
    consultaCepService as never,
    municipioWkService as never,
    provedores as never,
  );
  return {
    provedores,
    service,
    prisma,
    receitaWsClient,
    brasilApiClient,
    cache,
    orcamento,
    consultaCepService,
    municipioWkService,
  };
}

describe('ConsultaCnpjService - economia de requisicoes', () => {
  it('CNPJ invalido (DV) nao toca em base, cache nem provedor', async () => {
    const m = montar();

    await expect(m.service.consultar('07127994000151')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(m.prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(m.cache.obter).not.toHaveBeenCalled();
    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
  });

  it('CPF nao e consultavel neste endpoint', async () => {
    const m = montar();

    await expect(m.service.consultar('529.982.247-25')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
  });

  it('CNPJ ja na base: NAO consulta cache nem provedor, e avisa o vendedor responsavel', async () => {
    const m = montar();
    m.prisma.cliente.findFirst.mockResolvedValue({
      razaoSocial: 'MEGA FIOS LTDA',
      nomeFantasia: null,
      statusEnvioErp: 'ENVIADO',
      vendedores: [{ vendedor: { nome: 'Joana' } }],
    });

    const resultado = await m.service.consultar('07.127.994/0001-50');

    expect(resultado.origem).toBe('BASE');
    expect(resultado.jaCadastrado?.vendedorResponsavel).toBe('Joana');
    expect(resultado.dados).toBeNull();
    expect(m.cache.obter).not.toHaveBeenCalled();
    expect(m.orcamento.tentarReservar).not.toHaveBeenCalled();
    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
    expect(m.brasilApiClient.consultar).not.toHaveBeenCalled();
  });

  it('busca na base pelas DUAS formas do documento (o sync grava formatado)', async () => {
    const m = montar();

    await m.service.consultar(CNPJ);

    expect(m.prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cpfCnpj: { in: [CNPJ, '07.127.994/0001-50'] } },
      }),
    );
  });

  it('cache hit: nao gasta orcamento nem chama nenhum provedor', async () => {
    const m = montar();
    const dados = dadosDaBrasilApi();
    m.cache.obter.mockResolvedValue({ tipo: 'encontrado', dados });

    const resultado = await m.service.consultar(CNPJ);

    expect(resultado.origem).toBe('CACHE');
    expect(m.orcamento.tentarReservar).not.toHaveBeenCalled();
    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
    expect(m.brasilApiClient.consultar).not.toHaveBeenCalled();
  });

  it('cache negativo: 404 sem chamar provedor', async () => {
    const m = montar();
    m.cache.obter.mockResolvedValue({ tipo: 'nao-encontrado' });

    await expect(m.service.consultar(CNPJ)).rejects.toBeInstanceOf(NotFoundException);
    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
  });

  it('falha em cache (de uma consulta que acabou de falhar): repete a MESMA falha sem chamar provedor', async () => {
    const m = montar();
    m.cache.obter.mockResolvedValue({ tipo: 'falha', status: 429, mensagem: 'limite' });

    await expect(m.service.consultar(CNPJ)).rejects.toMatchObject({ status: 429 });
    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
    expect(m.brasilApiClient.consultar).not.toHaveBeenCalled();
  });

  it('single-flight: quem perde o lock espera o cache de quem ganhou e NAO chama o provedor', async () => {
    const m = montar();
    m.cache.tentarLock.mockResolvedValue(false);
    m.cache.obter
      .mockResolvedValueOnce(null) // checagem inicial
      .mockResolvedValueOnce({ tipo: 'encontrado', dados: dadosDaBrasilApi() });

    const resultado = await m.service.consultar(CNPJ);

    expect(resultado.origem).toBe('CACHE');
    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
    expect(m.brasilApiClient.consultar).not.toHaveBeenCalled();
    expect(m.cache.liberarLock).not.toHaveBeenCalled();
  });

  it('single-flight: quem perde o lock recebe a FALHA de quem ganhou (nao repete a chamada)', async () => {
    const m = montar();
    m.cache.tentarLock.mockResolvedValue(false);
    m.cache.obter
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tipo: 'falha', status: 502, mensagem: 'provedor fora' });

    await expect(m.service.consultar(CNPJ)).rejects.toMatchObject({ status: 502 });
    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
    expect(m.brasilApiClient.consultar).not.toHaveBeenCalled();
  });
});

describe('ConsultaCnpjService - provedores (ReceitaWS primaria, BrasilAPI reserva)', () => {
  it('com orcamento: reserva a vaga ANTES de chamar a ReceitaWS e guarda no cache', async () => {
    const m = montar();
    const ordem: string[] = [];
    m.orcamento.tentarReservar.mockImplementation(async () => {
      ordem.push('vaga');
      return true;
    });
    m.receitaWsClient.consultar.mockImplementation(async () => {
      ordem.push('receitaws');
      return RESPOSTA;
    });

    const resultado = await m.service.consultar('07.127.994/0001-50');

    expect(ordem).toEqual(['vaga', 'receitaws']);
    expect(resultado.origem).toBe('API');
    expect(resultado.dados?.razaoSocial).toBe('MEGA FIOS LTDA');
    expect(m.brasilApiClient.consultar).not.toHaveBeenCalled();
    expect(m.cache.guardar).toHaveBeenCalledWith(CNPJ, expect.objectContaining({ razaoSocial: 'MEGA FIOS LTDA' }));
    expect(m.cache.liberarLock).toHaveBeenCalledWith(CNPJ);
  });

  it('orcamento da ReceitaWS esgotado: vai direto pra BrasilAPI, sem chamar a ReceitaWS', async () => {
    const m = montar();
    m.orcamento.tentarReservar.mockResolvedValue(false);

    const resultado = await m.service.consultar(CNPJ);

    expect(m.receitaWsClient.consultar).not.toHaveBeenCalled();
    expect(m.brasilApiClient.consultar).toHaveBeenCalledWith(CNPJ, expect.objectContaining({ formato: 'BRASILAPI' }));
    expect(resultado.dados?.razaoSocial).toBe('MEGA FIOS LTDA (BRASILAPI)');
    expect(m.cache.guardar).toHaveBeenCalled();
  });

  it('429 da ReceitaWS: bloqueia o provedor por um tempo e usa a BrasilAPI', async () => {
    const m = montar();
    m.receitaWsClient.consultar.mockRejectedValue(new HttpException('limite', 429));

    const resultado = await m.service.consultar(CNPJ);

    expect(m.orcamento.bloquear).toHaveBeenCalledWith('receitaws-id');
    expect(resultado.dados?.razaoSocial).toBe('MEGA FIOS LTDA (BRASILAPI)');
  });

  it('ReceitaWS fora do ar (5xx): usa a BrasilAPI sem bloquear o orcamento', async () => {
    const m = montar();
    m.receitaWsClient.consultar.mockRejectedValue(new BadGatewayException('fora'));

    const resultado = await m.service.consultar(CNPJ);

    expect(m.orcamento.bloquear).not.toHaveBeenCalled();
    expect(resultado.dados?.razaoSocial).toBe('MEGA FIOS LTDA (BRASILAPI)');
  });

  it('404 da ReceitaWS e definitivo: nao tenta a BrasilAPI e vai pro cache negativo', async () => {
    const m = montar();
    m.receitaWsClient.consultar.mockRejectedValue(new NotFoundException('CNPJ nao encontrado'));

    await expect(m.service.consultar(CNPJ)).rejects.toBeInstanceOf(NotFoundException);

    expect(m.brasilApiClient.consultar).not.toHaveBeenCalled();
    expect(m.cache.guardarNaoEncontrado).toHaveBeenCalledWith(CNPJ);
    expect(m.cache.liberarLock).toHaveBeenCalledWith(CNPJ);
  });

  it('os dois provedores falham: propaga o erro, guarda a falha pros concorrentes e libera o lock', async () => {
    const m = montar();
    m.receitaWsClient.consultar.mockRejectedValue(new HttpException('limite', 429));
    m.brasilApiClient.consultar.mockRejectedValue(new BadGatewayException('fora'));

    await expect(m.service.consultar(CNPJ)).rejects.toBeInstanceOf(BadGatewayException);

    expect(m.cache.guardarFalha).toHaveBeenCalledWith(CNPJ, 502, 'fora');
    expect(m.cache.guardarNaoEncontrado).not.toHaveBeenCalled();
    expect(m.cache.liberarLock).toHaveBeenCalledWith(CNPJ);
  });
});

describe('ConsultaCnpjService - autopreenchimento', () => {
  it('ReceitaWS (sem IBGE): descobre o IBGE pelo CEP e o idMunicipio do Radar', async () => {
    const m = montar();

    const resultado = await m.service.consultar(CNPJ);

    expect(m.consultaCepService.consultar).toHaveBeenCalledWith('64076130');
    expect(m.municipioWkService.idPorCodigoIbge).toHaveBeenCalledWith('2211001');
    expect(resultado.enderecoSugerido).toMatchObject({
      cep: '64076130',
      logradouro: 'AV DEPUTADO PAULO FERRAZ',
      numero: '5250',
      semNumero: false,
      municipio: 'TERESINA',
      uf: 'PI',
      codigoIbge: '2211001',
      idMunicipioErp: '52002816',
    });
  });

  it('BrasilAPI ja traz o IBGE: NAO consulta a API de CEP', async () => {
    const m = montar();
    m.orcamento.tentarReservar.mockResolvedValue(false);

    const resultado = await m.service.consultar(CNPJ);

    expect(m.consultaCepService.consultar).not.toHaveBeenCalled();
    expect(m.municipioWkService.idPorCodigoIbge).toHaveBeenCalledWith('2211001');
    expect(resultado.enderecoSugerido?.idMunicipioErp).toBe('52002816');
  });

  it('falha ao resolver o CEP nao derruba a consulta (IBGE e idMunicipio ficam null)', async () => {
    const m = montar();
    m.consultaCepService.consultar.mockRejectedValue(new Error('cep fora'));

    const resultado = await m.service.consultar(CNPJ);

    expect(resultado.dados?.razaoSocial).toBe('MEGA FIOS LTDA');
    expect(resultado.enderecoSugerido).toMatchObject({ codigoIbge: null, idMunicipioErp: null });
    expect(m.municipioWkService.idPorCodigoIbge).not.toHaveBeenCalled();
  });

  it('numero "S/N" vira semNumero', async () => {
    const m = montar();
    m.receitaWsClient.consultar.mockResolvedValue({ ...RESPOSTA, numero: 'S/N' });

    const resultado = await m.service.consultar(CNPJ);

    expect(resultado.enderecoSugerido).toMatchObject({ numero: null, semNumero: true });
  });
});
