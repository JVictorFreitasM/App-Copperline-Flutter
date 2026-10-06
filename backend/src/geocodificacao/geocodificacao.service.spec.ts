import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { GeocodificacaoService } from './geocodificacao.service';

function montar() {
  const memoria = new Map<string, string>();
  const redis = {
    get: jest.fn(async (chave: string) => memoria.get(chave) ?? null),
    set: jest.fn(async (chave: string, valor: string) => {
      memoria.set(chave, valor);
      return 'OK';
    }),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };
  const httpService = {
    get: jest.fn().mockReturnValue(
      of({ data: [{ lat: '-5.0892', lon: '-42.8019', display_name: 'Teresina, PI' }] }),
    ),
  };
  const configService = { get: () => undefined };
  return {
    redis,
    httpService,
    service: new GeocodificacaoService(httpService as never, configService as never, redis as never),
  };
}

describe('GeocodificacaoService', () => {
  it('geocodifica com User-Agent identificado e pais restrito ao Brasil', async () => {
    const m = montar();

    const resultado = await m.service.localizar('Av Frei Serafim, Teresina PI');

    expect(resultado).toEqual({ latitude: -5.0892, longitude: -42.8019, nomeExibicao: 'Teresina, PI' });
    expect(m.httpService.get).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/search',
      expect.objectContaining({
        params: expect.objectContaining({ countrycodes: 'br', limit: 1 }),
        headers: expect.objectContaining({ 'User-Agent': 'CopperlineApp/1.0' }),
      }),
    );
  });

  it('mesma consulta (mesmo com espacos/caixa diferentes) sai do cache - 1 chamada so', async () => {
    const m = montar();

    await m.service.localizar('Av Frei Serafim, Teresina PI');
    await m.service.localizar('  av frei  serafim, teresina pi ');

    expect(m.httpService.get).toHaveBeenCalledTimes(1);
  });

  it('endereco nao localizado vira 404 e fica em cache negativo', async () => {
    const m = montar();
    m.httpService.get.mockReturnValue(of({ data: [] }));

    await expect(m.service.localizar('rua que nao existe 000')).rejects.toBeInstanceOf(NotFoundException);
    await expect(m.service.localizar('rua que nao existe 000')).rejects.toBeInstanceOf(NotFoundException);

    expect(m.httpService.get).toHaveBeenCalledTimes(1);
  });

  it('respeita o limite global de 1 req/s do Nominatim antes de chamar', async () => {
    const m = montar();

    await m.service.localizar('Av Frei Serafim, Teresina PI');

    expect(m.redis.incr).toHaveBeenCalledWith(expect.stringMatching(/^rate:geocode:\d+$/));
  });

  it('falha do servico de mapas vira 502 e nao entra no cache negativo', async () => {
    const m = montar();
    m.httpService.get.mockReturnValue(throwError(() => new Error('timeout')));

    await expect(m.service.localizar('Av Frei Serafim, Teresina PI')).rejects.toBeInstanceOf(BadGatewayException);
    expect([...m.redis.set.mock.calls.map((c) => c[0])].some((k) => String(k).includes('nao-encontrado'))).toBe(false);
  });
});
