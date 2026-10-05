import {
  calcularProximoEnvio,
  RecorrenciaInvalidaError,
  validarRecorrencia,
  type RecorrenciaMensagem,
} from './proximo-envio-periodico';

// Todas as datas dos testes escritas em UTC; Sao Paulo = UTC-3, entao
// "08:00 em SP" = 11:00Z.
const utc = (iso: string) => new Date(iso);

describe('calcularProximoEnvio', () => {
  it('DIARIA: hoje mesmo se o horario ainda nao passou (em SP)', () => {
    // 2026-10-05 (segunda) 10:00Z = 07:00 SP -> 08:00 SP ainda vem hoje.
    const proximo = calcularProximoEnvio(
      { frequencia: 'DIARIA', horario: '08:00' },
      utc('2026-10-05T10:00:00Z'),
    );
    expect(proximo).toEqual(utc('2026-10-05T11:00:00Z'));
  });

  it('DIARIA: amanha se o horario de hoje ja passou', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'DIARIA', horario: '08:00' },
      utc('2026-10-05T12:00:00Z'),
    );
    expect(proximo).toEqual(utc('2026-10-06T11:00:00Z'));
  });

  it('e estritamente depois: no exato minuto do envio, vai pro proximo ciclo', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'DIARIA', horario: '08:00' },
      utc('2026-10-05T11:00:00Z'),
    );
    expect(proximo).toEqual(utc('2026-10-06T11:00:00Z'));
  });

  it('usa o dia de SP, nao o dia UTC (02:00Z ainda e dia anterior em SP)', () => {
    // 2026-10-06T02:00Z = 2026-10-05 23:00 SP -> 23:30 SP ainda e' dia 05.
    const proximo = calcularProximoEnvio(
      { frequencia: 'DIARIA', horario: '23:30' },
      utc('2026-10-06T02:00:00Z'),
    );
    expect(proximo).toEqual(utc('2026-10-06T02:30:00Z'));
  });

  it('DIAS_UTEIS: sexta apos o horario pula pra segunda', () => {
    // 2026-10-09 e' sexta; 14:00Z = 11:00 SP, depois das 08:00.
    const proximo = calcularProximoEnvio(
      { frequencia: 'DIAS_UTEIS', horario: '08:00' },
      utc('2026-10-09T14:00:00Z'),
    );
    expect(proximo).toEqual(utc('2026-10-12T11:00:00Z'));
  });

  it('DIAS_UTEIS: sabado cai na segunda', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'DIAS_UTEIS', horario: '08:00' },
      utc('2026-10-10T12:00:00Z'),
    );
    expect(proximo).toEqual(utc('2026-10-12T11:00:00Z'));
  });

  it('SEMANAL: proximo dia da semana escolhido (segunda = 1)', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'SEMANAL', horario: '09:00', diaSemana: 1 },
      utc('2026-10-06T12:00:00Z'), // terca
    );
    expect(proximo).toEqual(utc('2026-10-12T12:00:00Z'));
  });

  it('SEMANAL: mesmo dia da semana com horario ainda por vir fica hoje', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'SEMANAL', horario: '09:00', diaSemana: 1 },
      utc('2026-10-05T10:00:00Z'), // segunda 07:00 SP
    );
    expect(proximo).toEqual(utc('2026-10-05T12:00:00Z'));
  });

  it('MENSAL: dia do mes ja passou -> mes seguinte', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'MENSAL', horario: '08:00', diaMes: 5 },
      utc('2026-10-05T12:00:00Z'),
    );
    expect(proximo).toEqual(utc('2026-11-05T11:00:00Z'));
  });

  it('MENSAL dia 31: mes curto cai no ultimo dia (30/11)', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'MENSAL', horario: '08:00', diaMes: 31 },
      utc('2026-10-31T12:00:00Z'),
    );
    expect(proximo).toEqual(utc('2026-11-30T11:00:00Z'));
  });

  it('MENSAL dia 30 em fevereiro cai no dia 28 (ano nao bissexto)', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'MENSAL', horario: '08:00', diaMes: 30 },
      utc('2027-02-01T12:00:00Z'),
    );
    expect(proximo).toEqual(utc('2027-02-28T11:00:00Z'));
  });

  it('virada de ano', () => {
    const proximo = calcularProximoEnvio(
      { frequencia: 'DIARIA', horario: '08:00' },
      utc('2026-12-31T15:00:00Z'),
    );
    expect(proximo).toEqual(utc('2027-01-01T11:00:00Z'));
  });
});

describe('validarRecorrencia', () => {
  const base: RecorrenciaMensagem = { frequencia: 'DIARIA', horario: '08:00' };

  it.each(['8:00', '24:00', '08:60', '08h00', ''])('rejeita horario %p', (horario) => {
    expect(() => validarRecorrencia({ ...base, horario })).toThrow(RecorrenciaInvalidaError);
  });

  it('SEMANAL exige diaSemana de 0 a 6', () => {
    expect(() => validarRecorrencia({ ...base, frequencia: 'SEMANAL' })).toThrow(RecorrenciaInvalidaError);
    expect(() => validarRecorrencia({ ...base, frequencia: 'SEMANAL', diaSemana: 7 })).toThrow(
      RecorrenciaInvalidaError,
    );
    expect(() => validarRecorrencia({ ...base, frequencia: 'SEMANAL', diaSemana: 0 })).not.toThrow();
  });

  it('MENSAL exige diaMes de 1 a 31', () => {
    expect(() => validarRecorrencia({ ...base, frequencia: 'MENSAL' })).toThrow(RecorrenciaInvalidaError);
    expect(() => validarRecorrencia({ ...base, frequencia: 'MENSAL', diaMes: 0 })).toThrow(
      RecorrenciaInvalidaError,
    );
    expect(() => validarRecorrencia({ ...base, frequencia: 'MENSAL', diaMes: 32 })).toThrow(
      RecorrenciaInvalidaError,
    );
    expect(() => validarRecorrencia({ ...base, frequencia: 'MENSAL', diaMes: 31 })).not.toThrow();
  });
});
