import { HttpException } from '@nestjs/common';
import { aguardarVagaGlobal } from './limitador-global';

// Redis em memoria so com o que o limitador usa (INCR + EXPIRE).
function redisEmMemoria() {
  const contadores = new Map<string, number>();
  return {
    incr: jest.fn(async (chave: string) => {
      const valor = (contadores.get(chave) ?? 0) + 1;
      contadores.set(chave, valor);
      return valor;
    }),
    expire: jest.fn(async () => 1),
  };
}

describe('aguardarVagaGlobal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-06T12:00:00.100Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('10 chamadas simultaneas: nunca mais que 3 por segundo, todas acabam passando', async () => {
    const redis = redisEmMemoria();
    const passagemPorSegundo = new Map<number, number>();

    const chamadas = Array.from({ length: 10 }, async () => {
      await aguardarVagaGlobal(redis as never, 'teste', 3, 6000);
      const segundo = Math.floor(Date.now() / 1000);
      passagemPorSegundo.set(segundo, (passagemPorSegundo.get(segundo) ?? 0) + 1);
    });

    await jest.advanceTimersByTimeAsync(5000);
    await Promise.all(chamadas);

    expect([...passagemPorSegundo.values()].every((quantidade) => quantidade <= 3)).toBe(true);
    expect([...passagemPorSegundo.values()].reduce((a, b) => a + b, 0)).toBe(10);
    expect(passagemPorSegundo.size).toBeGreaterThanOrEqual(4);
  });

  it('abaixo do limite passa na hora', async () => {
    const redis = redisEmMemoria();

    await aguardarVagaGlobal(redis as never, 'teste', 3, 6000);
    await aguardarVagaGlobal(redis as never, 'teste', 3, 6000);

    expect(redis.incr).toHaveBeenCalledTimes(2);
  });

  it('desiste com 429 quando a fila passa da espera maxima', async () => {
    const redis = redisEmMemoria();
    const chamadas = Array.from({ length: 20 }, () =>
      aguardarVagaGlobal(redis as never, 'teste', 1, 6000).then(
        () => 'passou',
        (erro: unknown) => erro,
      ),
    );

    await jest.advanceTimersByTimeAsync(30_000);
    const rejeitadas = (await Promise.all(chamadas)).filter((r) => r instanceof HttpException);

    expect(rejeitadas.length).toBeGreaterThan(0);
    expect((rejeitadas[0] as HttpException).getStatus()).toBe(429);
  });

  it('prefixos diferentes nao dividem o limite', async () => {
    const redis = redisEmMemoria();

    await aguardarVagaGlobal(redis as never, 'a', 1, 6000);
    await aguardarVagaGlobal(redis as never, 'b', 1, 6000);

    expect(redis.incr).toHaveBeenCalledWith(expect.stringMatching(/^rate:a:/));
    expect(redis.incr).toHaveBeenCalledWith(expect.stringMatching(/^rate:b:/));
  });
});
