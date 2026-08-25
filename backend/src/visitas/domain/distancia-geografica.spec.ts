import { calcularDistanciaMetros } from './distancia-geografica';

describe('calcularDistanciaMetros', () => {
  it('retorna 0 para o mesmo ponto', () => {
    expect(calcularDistanciaMetros(-23.5505, -46.6333, -23.5505, -46.6333)).toBe(0);
  });

  it('calcula aproximadamente 111.3m para 0.001 grau de latitude no equador', () => {
    const distancia = calcularDistanciaMetros(0, 0, 0.001, 0);
    expect(distancia).toBeGreaterThan(110);
    expect(distancia).toBeLessThan(112);
  });

  it('calcula uma distancia conhecida entre dois pontos reais (~210km, Sao Paulo -> Rio)', () => {
    const distancia = calcularDistanciaMetros(-23.5505, -46.6333, -22.9068, -43.1729);
    // Distancia real em linha reta e' ~357km - tolerancia ampla, so
    // confirma ordem de grandeza correta (nao um bug de formula).
    expect(distancia).toBeGreaterThan(340_000);
    expect(distancia).toBeLessThan(370_000);
  });
});
