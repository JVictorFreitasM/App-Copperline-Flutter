import { ehMomentoDoRelatorio, horarioOuPadrao } from './horario-relatorio';

describe('horarioOuPadrao', () => {
  it('aceita HH:MM valido', () => {
    expect(horarioOuPadrao(' 08:30 ', '07:00')).toBe('08:30');
  });
  it.each([undefined, '', '7:00', '25:00', '07:60', 'abc'])('%p cai no padrao', (valor) => {
    expect(horarioOuPadrao(valor, '07:00')).toBe('07:00');
  });
});

describe('ehMomentoDoRelatorio (horario de Brasilia, seg-sex)', () => {
  // 2026-10-08 e' quinta; Brasilia = UTC-3.
  it('quinta 07:00 em Brasilia (10:00 UTC) dispara', () => {
    expect(ehMomentoDoRelatorio(new Date('2026-10-08T10:00:30.000Z'), '07:00')).toBe(true);
  });
  it('mesmo horario em UTC (07:00Z = 04:00 Brasilia) nao dispara', () => {
    expect(ehMomentoDoRelatorio(new Date('2026-10-08T07:00:00.000Z'), '07:00')).toBe(false);
  });
  it('outro minuto nao dispara', () => {
    expect(ehMomentoDoRelatorio(new Date('2026-10-08T10:01:00.000Z'), '07:00')).toBe(false);
  });
  it('sabado e domingo nao disparam', () => {
    expect(ehMomentoDoRelatorio(new Date('2026-10-10T10:00:00.000Z'), '07:00')).toBe(false);
    expect(ehMomentoDoRelatorio(new Date('2026-10-11T10:00:00.000Z'), '07:00')).toBe(false);
  });
});
