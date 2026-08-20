import {
  buscarPorJanelas,
  contagemSuspeitaDeTruncamento,
  gerarSubJanelas,
} from './paginacao-por-janela';

describe('gerarSubJanelas', () => {
  it('fatia a janela total em sub-janelas do tamanho informado', () => {
    const desde = new Date('2026-01-01T00:00:00Z');
    const ate = new Date('2026-01-03T12:00:00Z');
    const umDiaMs = 24 * 60 * 60 * 1000;

    const subJanelas = gerarSubJanelas({ desde, ate }, umDiaMs);

    expect(subJanelas).toHaveLength(3);
    expect(subJanelas[0]).toEqual({
      desde,
      ate: new Date('2026-01-02T00:00:00Z'),
    });
    expect(subJanelas[1]).toEqual({
      desde: new Date('2026-01-02T00:00:00Z'),
      ate: new Date('2026-01-03T00:00:00Z'),
    });
    // ultima sub-janela e truncada em `ate`, nao extrapola
    expect(subJanelas[2]).toEqual({
      desde: new Date('2026-01-03T00:00:00Z'),
      ate,
    });
  });

  it('retorna lista vazia quando desde >= ate (nada a sincronizar)', () => {
    const agora = new Date('2026-01-01T00:00:00Z');
    expect(gerarSubJanelas({ desde: agora, ate: agora }, 1000)).toEqual([]);
  });
});

describe('contagemSuspeitaDeTruncamento', () => {
  it('sinaliza contagens redondas conhecidas', () => {
    expect(contagemSuspeitaDeTruncamento(500)).toBe(true);
    expect(contagemSuspeitaDeTruncamento(1000)).toBe(true);
  });

  it('nao sinaliza contagens comuns', () => {
    expect(contagemSuspeitaDeTruncamento(0)).toBe(false);
    expect(contagemSuspeitaDeTruncamento(7)).toBe(false);
    expect(contagemSuspeitaDeTruncamento(501)).toBe(false);
  });
});

describe('buscarPorJanelas', () => {
  it('agrega os registros de cada sub-janela, chamando sequencialmente', async () => {
    const chamadas: unknown[] = [];
    const buscarSubJanela = jest.fn((subJanela: unknown) => {
      chamadas.push(subJanela);
      return Promise.resolve([`registro-${chamadas.length}`]);
    });

    const resultado = await buscarPorJanelas(
      {
        desde: new Date('2026-01-01T00:00:00Z'),
        ate: new Date('2026-01-03T00:00:00Z'),
      },
      24 * 60 * 60 * 1000,
      buscarSubJanela,
    );

    expect(buscarSubJanela).toHaveBeenCalledTimes(2);
    expect(resultado.registros).toEqual(['registro-1', 'registro-2']);
    expect(resultado.avisos).toEqual([]);
  });

  it('gera aviso quando uma sub-janela retorna contagem suspeita', async () => {
    const buscarSubJanela = jest.fn(() =>
      Promise.resolve(new Array<string>(500).fill('x')),
    );

    const resultado = await buscarPorJanelas(
      {
        desde: new Date('2026-01-01T00:00:00Z'),
        ate: new Date('2026-01-02T00:00:00Z'),
      },
      24 * 60 * 60 * 1000,
      buscarSubJanela,
    );

    expect(resultado.avisos).toHaveLength(1);
    expect(resultado.avisos[0]).toMatch(/500 registro/);
  });
});
