import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

// Cliente Redis compartilhado, de vida longa (mesmo padrao do BullModule.
// forRoot no AppModule) - diferente do RedisHealthIndicator, que abre uma
// conexao efemera so pra testar disponibilidade. Usado por infra
// cross-cutting que precisa do Redis direto (ex: RateLimitGuard), nao pra
// cache/fila especifico de um dominio.
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) =>
        new Redis({
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: Number(configService.getOrThrow<string>('REDIS_PORT')),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
