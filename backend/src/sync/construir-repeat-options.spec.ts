import { construirRepeatOptions } from './construir-repeat-options';

describe('construirRepeatOptions', () => {
  it('CONFIGURAVEL vira { every } em ms', () => {
    const opcoes = construirRepeatOptions({
      tipoCadencia: 'CONFIGURAVEL',
      intervaloMinutos: 45,
      horarioFixo: null,
      diasSemana: [],
    });

    expect(opcoes).toEqual({ every: 45 * 60_000 });
  });

  it('INCREMENTAL vira { every } em ms', () => {
    const opcoes = construirRepeatOptions({
      tipoCadencia: 'INCREMENTAL',
      intervaloMinutos: 30,
      horarioFixo: null,
      diasSemana: [],
    });

    expect(opcoes).toEqual({ every: 30 * 60_000 });
  });

  it('JANELA_FIXA_DIARIA sem dias da semana vira cron "todo dia"', () => {
    const opcoes = construirRepeatOptions({
      tipoCadencia: 'JANELA_FIXA_DIARIA',
      intervaloMinutos: null,
      horarioFixo: '03:15',
      diasSemana: [],
    });

    expect(opcoes).toEqual({ pattern: '15 3 * * *' });
  });

  it('INCREMENTAL_NOTURNO com dias da semana vira cron restrito', () => {
    const opcoes = construirRepeatOptions({
      tipoCadencia: 'INCREMENTAL_NOTURNO',
      intervaloMinutos: null,
      horarioFixo: '00:00',
      diasSemana: [1, 3, 5],
    });

    expect(opcoes).toEqual({ pattern: '0 0 * * 1,3,5' });
  });

  it('lanca erro quando intervaloMinutos falta pra CONFIGURAVEL', () => {
    expect(() =>
      construirRepeatOptions({
        tipoCadencia: 'CONFIGURAVEL',
        intervaloMinutos: null,
        horarioFixo: null,
        diasSemana: [],
      }),
    ).toThrow();
  });

  it('lanca erro quando horarioFixo falta pra JANELA_FIXA_DIARIA', () => {
    expect(() =>
      construirRepeatOptions({
        tipoCadencia: 'JANELA_FIXA_DIARIA',
        intervaloMinutos: null,
        horarioFixo: null,
        diasSemana: [],
      }),
    ).toThrow();
  });

  it('lanca erro pra horarioFixo em formato invalido', () => {
    expect(() =>
      construirRepeatOptions({
        tipoCadencia: 'JANELA_FIXA_DIARIA',
        intervaloMinutos: null,
        horarioFixo: '25:99',
        diasSemana: [],
      }),
    ).toThrow();
  });
});
