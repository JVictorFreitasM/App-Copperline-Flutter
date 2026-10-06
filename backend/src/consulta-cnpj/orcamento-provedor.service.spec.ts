import { OrcamentoProvedorService } from './orcamento-provedor.service';

// Redis em memoria so com o que o orcamento usa.
function redisEmMemoria() {
  const contadores = new Map<string, number>();
  const strings = new Map<string, string>();
  return {
    incr: jest.fn(async (chave: string) => {
      const valor = (contadores.get(chave) ?? 0) + 1;
      contadores.set(chave, valor);
      return valor;
    }),
    expire: jest.fn(async () => 1),
    get: jest.fn(async (chave: string) => strings.get(chave) ?? null),
    set: jest.fn(async (chave: string, valor: string) => {
      strings.set(chave, valor);
      return 'OK';
    }),
  };
}

function montar(config: Record<string, string> = {}) {
  const redis = redisEmMemoria();
  const configService = { get: (chave: string) => config[chave] };
  return { redis, service: new OrcamentoProvedorService(redis as never, configService as never) };
}

describe('OrcamentoProvedorService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-06T12:00:10.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('padrao da ReceitaWS: 3 por janela de 60 s - a quarta chamada NAO tem vaga (sem esperar)', async () => {
    const { service } = montar();

    const resultados = [];
    for (let i = 0; i < 5; i++) {
      resultados.push(await service.tentarReservar('receitaws'));
    }

    expect(resultados).toEqual([true, true, true, false, false]);
  });

  it('a janela renova depois de 60 s', async () => {
    const { service } = montar();
    for (let i = 0; i < 3; i++) await service.tentarReservar('receitaws');
    expect(await service.tentarReservar('receitaws')).toBe(false);

    jest.setSystemTime(new Date('2026-10-06T12:01:10.000Z'));

    expect(await service.tentarReservar('receitaws')).toBe(true);
  });

  it('limite e janela configuraveis por env', async () => {
    const { service } = montar({ RECEITAWS_LIMITE: '5', RECEITAWS_JANELA_SEGUNDOS: '10' });

    const resultados = [];
    for (let i = 0; i < 6; i++) resultados.push(await service.tentarReservar('receitaws'));
    expect(resultados).toEqual([true, true, true, true, true, false]);

    jest.setSystemTime(new Date('2026-10-06T12:00:25.000Z'));
    expect(await service.tentarReservar('receitaws')).toBe(true);
  });

  it('provedores diferentes tem orcamentos independentes', async () => {
    const { service } = montar();
    for (let i = 0; i < 3; i++) await service.tentarReservar('receitaws');

    expect(await service.tentarReservar('outro')).toBe(true);
  });

  it('depois de um 429 do provedor, fica bloqueado mesmo com vaga na janela', async () => {
    const { service, redis } = montar();

    await service.bloquear('receitaws');

    expect(await service.tentarReservar('receitaws')).toBe(false);
    expect(redis.set).toHaveBeenCalledWith('rate:receitaws:bloqueado', '1', 'EX', 60);
    expect(redis.incr).not.toHaveBeenCalled();
  });
});
