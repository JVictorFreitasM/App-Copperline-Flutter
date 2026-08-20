import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import {
  RATE_LIMIT_KEY,
  type RateLimitConfig,
} from '../decorators/rate-limit.decorator';

function contextFake(usuarioSub?: string) {
  const request = {
    user: usuarioSub ? { sub: usuarioSub } : undefined,
    ip: '1.2.3.4',
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
  } as never;
}

function reflectorFake(config: RateLimitConfig | undefined) {
  return {
    get: jest.fn((chave: string) =>
      chave === RATE_LIMIT_KEY ? config : undefined,
    ),
  } as unknown as Reflector;
}

describe('RateLimitGuard.canActivate', () => {
  it('deixa passar quando a rota nao tem @RateLimit', async () => {
    const redis = { incr: jest.fn(), expire: jest.fn() };
    const guard = new RateLimitGuard(reflectorFake(undefined), redis as never);

    await expect(guard.canActivate(contextFake('user-1'))).resolves.toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('permite requisicoes dentro do limite e seta TTL na primeira chamada', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn() };
    const config: RateLimitConfig = {
      prefixo: 'estoque',
      limite: 30,
      janelaSegundos: 60,
    };
    const guard = new RateLimitGuard(reflectorFake(config), redis as never);

    await expect(guard.canActivate(contextFake('user-1'))).resolves.toBe(true);
    expect(redis.incr).toHaveBeenCalledWith('rate:estoque:user-1');
    expect(redis.expire).toHaveBeenCalledWith('rate:estoque:user-1', 60);
  });

  it('bloqueia com 429 quando o contador excede o limite', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(31), expire: jest.fn() };
    const config: RateLimitConfig = {
      prefixo: 'estoque',
      limite: 30,
      janelaSegundos: 60,
    };
    const guard = new RateLimitGuard(reflectorFake(config), redis as never);

    await expect(guard.canActivate(contextFake('user-1'))).rejects.toThrow(
      HttpException,
    );
  });

  it('separa o contador por usuario (sub), nao compartilha entre usuarios diferentes', async () => {
    const redis = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn() };
    const config: RateLimitConfig = {
      prefixo: 'estoque',
      limite: 30,
      janelaSegundos: 60,
    };
    const guard = new RateLimitGuard(reflectorFake(config), redis as never);

    await guard.canActivate(contextFake('user-1'));
    await guard.canActivate(contextFake('user-2'));

    expect(redis.incr).toHaveBeenNthCalledWith(1, 'rate:estoque:user-1');
    expect(redis.incr).toHaveBeenNthCalledWith(2, 'rate:estoque:user-2');
  });
});
