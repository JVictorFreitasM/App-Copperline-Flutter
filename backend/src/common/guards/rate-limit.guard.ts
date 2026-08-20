import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import type { Request } from 'express';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import {
  RATE_LIMIT_KEY,
  type RateLimitConfig,
} from '../decorators/rate-limit.decorator';

// Janela fixa via INCR+EXPIRE (rate:<prefixo>:<usuario>, TTL = janela) -
// simples e suficiente pro caso de uso (throttle por usuario autenticado
// contra sistema externo caro de chamar, nao protecao anti-DDoS fina).
// So age em rotas marcadas com @RateLimit - sem o decorator, deixa passar.
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<RateLimitConfig | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    // Guard so faz sentido depois de requireAuth (request.user ja
    // populado) - ver modulos que aplicam @UseGuards(RateLimitGuard),
    // sempre encadeado apos requireAuth no MiddlewareConsumer.
    const usuario = request.user;
    const identificador = usuario?.sub ?? request.ip ?? 'desconhecido';
    const chave = `rate:${config.prefixo}:${identificador}`;

    const contagem = await this.redis.incr(chave);
    if (contagem === 1) {
      await this.redis.expire(chave, config.janelaSegundos);
    }

    if (contagem > config.limite) {
      throw new HttpException(
        'Muitas requisições - tente novamente em instantes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
