import { parseDataHoraBr } from './parse-data-br';

describe('parseDataHoraBr', () => {
  it('converte data com hora ("03/11/2025 00:00" -> Date UTC correta)', () => {
    const resultado = parseDataHoraBr('03/11/2025 00:00');
    expect(resultado?.toISOString()).toBe('2025-11-03T00:00:00.000Z');
  });

  it('converte data com hora diferente de meia-noite', () => {
    const resultado = parseDataHoraBr('31/08/2026 14:30');
    expect(resultado?.toISOString()).toBe('2026-08-31T14:30:00.000Z');
  });

  it('sentinel "00/00/0000 00:00" vira null (sem data), nao Invalid Date', () => {
    expect(parseDataHoraBr('00/00/0000 00:00')).toBeNull();
  });

  it('lanca erro para um valor que nao e uma data BR valida', () => {
    expect(() => parseDataHoraBr('abc')).toThrow();
  });
});
