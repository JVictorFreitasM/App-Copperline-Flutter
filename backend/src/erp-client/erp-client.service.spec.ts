import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, type AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { ErpClientService } from './erp-client.service';

function ok<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as never,
  };
}

function unauthorized(): AxiosError {
  return new AxiosError('Unauthorized', undefined, undefined, undefined, {
    status: 401,
    data: undefined,
    statusText: 'Unauthorized',
    headers: {},
    config: {} as never,
  });
}

function rateLimited(): AxiosError {
  return new AxiosError('Too Many Requests', undefined, undefined, undefined, {
    status: 429,
    data: undefined,
    statusText: 'Too Many Requests',
    headers: { 'retry-after': '0' },
    config: {} as never,
  });
}

const ENV: Record<string, string> = {
  WK_RADAR_API_URL: 'http://wk-radar-teste.local',
  WK_RADAR_EMPRESA: 'empresa-teste',
  WK_RADAR_USUARIO: 'usuario-teste',
  WK_RADAR_SENHA: 'senha-teste',
  // Zero pra nao esperar de verdade nos testes - o comportamento de
  // espacamento em si nao e o que estes testes verificam.
  WK_RADAR_MIN_REQUEST_INTERVAL_MS: '0',
};

function buildConfigService(): ConfigService {
  return {
    get: (key: string) => ENV[key],
    getOrThrow: (key: string) => {
      const value = ENV[key];
      if (value === undefined) throw new Error(`Missing env ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

describe('ErpClientService', () => {
  it('reutiliza o token entre chamadas em vez de reautenticar a cada requisicao', async () => {
    const post = jest
      .fn()
      .mockReturnValue(of(ok({ token: 'token-1', expiresIn: 900 })));
    const request = jest.fn().mockReturnValue(of(ok({ resultado: 'ok' })));
    const httpService = { post, request } as unknown as HttpService;

    const service = new ErpClientService(httpService, buildConfigService());

    await service.get('/comercial/v1/pedido');
    await service.get('/comercial/v1/pedido');

    expect(post).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('autentica no endpoint correto com credenciais vindas da configuracao, nunca hardcoded', async () => {
    const post = jest
      .fn()
      .mockReturnValue(of(ok({ token: 'token-1', expiresIn: 900 })));
    const request = jest.fn().mockReturnValue(of(ok({})));
    const httpService = { post, request } as unknown as HttpService;

    const service = new ErpClientService(httpService, buildConfigService());
    await service.get('/comercial/v1/pedido');

    expect(post).toHaveBeenCalledWith(
      'http://wk-radar-teste.local/wk.api/api/v1/token',
      {
        empresa: ENV.WK_RADAR_EMPRESA,
        nomeUsuario: ENV.WK_RADAR_USUARIO,
        senha: ENV.WK_RADAR_SENHA,
        idIntegrador: null,
      },
      { timeout: 30_000 },
    );
  });

  it('reautentica uma vez quando uma requisicao volta 401, sem propagar o erro se a segunda tentativa funcionar', async () => {
    const post = jest
      .fn()
      .mockReturnValueOnce(of(ok({ token: 'token-expirado', expiresIn: 900 })))
      .mockReturnValueOnce(of(ok({ token: 'token-novo', expiresIn: 900 })));
    const request = jest
      .fn()
      .mockReturnValueOnce(throwError(() => unauthorized()))
      .mockReturnValueOnce(of(ok({ resultado: 'ok' })));
    const httpService = { post, request } as unknown as HttpService;

    const service = new ErpClientService(httpService, buildConfigService());
    const resultado = await service.get('/comercial/v1/pedido');

    expect(resultado).toEqual({ resultado: 'ok' });
    expect(post).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('reage a 429 (throttling da Radar.API) com retry, sem propagar o erro se uma tentativa seguinte funcionar', async () => {
    const post = jest
      .fn()
      .mockReturnValue(of(ok({ token: 'token-1', expiresIn: 900 })));
    const request = jest
      .fn()
      .mockReturnValueOnce(throwError(() => rateLimited()))
      .mockReturnValueOnce(of(ok({ resultado: 'ok' })));
    const httpService = { post, request } as unknown as HttpService;

    const service = new ErpClientService(httpService, buildConfigService());
    const resultado = await service.get('/comercial/v1/pedido');

    expect(resultado).toEqual({ resultado: 'ok' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('desiste apos esgotar as tentativas contra 429 persistente, propagando o erro', async () => {
    const post = jest
      .fn()
      .mockReturnValue(of(ok({ token: 'token-1', expiresIn: 900 })));
    const request = jest.fn().mockReturnValue(throwError(() => rateLimited()));
    const httpService = { post, request } as unknown as HttpService;

    const service = new ErpClientService(httpService, buildConfigService());

    await expect(service.get('/comercial/v1/pedido')).rejects.toThrow(
      'Too Many Requests',
    );
    // 1 tentativa inicial + 3 retries (MAX_TENTATIVAS_APOS_429) = 4
    expect(request).toHaveBeenCalledTimes(4);
  });
});
