import { MunicipioWkService } from './municipio-wk.service';

const MUNICIPIOS = [
  { id: '52002816', codigoIBGE: 2211001, nome: 'Teresina' },
  { id: '16384', codigoIBGE: 1200013, nome: 'Acrelândia' },
];

function montar(emCache: string | null = null) {
  const erpClient = { get: jest.fn().mockResolvedValue(MUNICIPIOS) };
  const redis = {
    get: jest.fn().mockResolvedValue(emCache),
    set: jest.fn().mockResolvedValue('OK'),
  };
  return {
    erpClient,
    redis,
    service: new MunicipioWkService(erpClient as never, redis as never),
  };
}

describe('MunicipioWkService', () => {
  it('traduz IBGE em idMunicipio do Radar e guarda o mapa (com nomes) no Redis', async () => {
    const { service, erpClient, redis } = montar();

    expect(await service.idPorCodigoIbge('2211001')).toBe('52002816');
    expect(erpClient.get).toHaveBeenCalledWith('/empresarial/v1/municipio');
    expect(redis.set).toHaveBeenCalledWith(
      'cache:wk:municipios:v2',
      JSON.stringify({
        idPorIbge: { '2211001': '52002816', '1200013': '16384' },
        nomePorId: { '52002816': 'Teresina', '16384': 'Acrelândia' },
      }),
      'EX',
      7 * 24 * 60 * 60,
    );
  });

  it('devolve o nome do municipio pelo id do Radar', async () => {
    const { service } = montar();

    expect(await service.nomePorId('52002816')).toBe('Teresina');
    expect(await service.nomePorId('nao-existe')).toBeNull();
  });

  it('com o mapa em cache nao chama o Radar', async () => {
    const { service, erpClient } = montar(
      JSON.stringify({ idPorIbge: { '2211001': '52002816' }, nomePorId: {} }),
    );

    expect(await service.idPorCodigoIbge(2211001)).toBe('52002816');
    expect(erpClient.get).not.toHaveBeenCalled();
  });

  it('IBGE desconhecido devolve null', async () => {
    const { service } = montar();

    expect(await service.idPorCodigoIbge('9999999')).toBeNull();
  });

  it('com o cache frio, consultas SIMULTANEAS dividem UMA carga do Radar', async () => {
    const { service, erpClient } = montar();
    erpClient.get.mockImplementation(
      () => new Promise((resolver) => setTimeout(() => resolver(MUNICIPIOS), 20)),
    );

    const ids = await Promise.all(
      Array.from({ length: 9 }, () => service.idPorCodigoIbge('2211001')),
    );

    expect(erpClient.get).toHaveBeenCalledTimes(1);
    expect(ids.every((id) => id === '52002816')).toBe(true);
  });
});
