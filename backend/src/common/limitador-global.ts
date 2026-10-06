import { HttpException, HttpStatus } from '@nestjs/common';
import type { Redis } from 'ioredis';

// Limite GLOBAL (todos os usuarios e instancias do backend somados) de
// chamadas por segundo a um provedor externo. Janela de 1 s por INCR no Redis
// (rate:<prefixo>:<segundo>); quem nao cabe na janela ESPERA a proxima em vez
// de falhar, ate `esperaMaximaMs` - depois disso 429. Diferente do
// RateLimitGuard, que limita POR USUARIO.
export async function aguardarVagaGlobal(
  redis: Redis,
  prefixo: string,
  limitePorSegundo: number,
  esperaMaximaMs: number,
): Promise<void> {
  const limiteDeTempo = Date.now() + esperaMaximaMs;

  for (;;) {
    const agora = Date.now();
    const segundo = Math.floor(agora / 1000);
    const chave = `rate:${prefixo}:${segundo}`;

    const contagem = await redis.incr(chave);
    if (contagem === 1) {
      await redis.expire(chave, 2);
    }
    if (contagem <= limitePorSegundo) {
      return;
    }

    const ateProximoSegundoMs = (segundo + 1) * 1000 - agora;
    if (agora + ateProximoSegundoMs > limiteDeTempo) {
      throw new HttpException(
        'Muitas consultas no momento - tente novamente em instantes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await new Promise((resolver) =>
      setTimeout(resolver, ateProximoSegundoMs + 20),
    );
  }
}
