import { HttpModule } from '@nestjs/axios';
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { RedisModule } from '../redis/redis.module';
import { GeocodificacaoController } from './geocodificacao.controller';
import { GeocodificacaoService } from './geocodificacao.service';

@Module({
  imports: [HttpModule, RedisModule],
  controllers: [GeocodificacaoController],
  providers: [GeocodificacaoService, RateLimitGuard],
})
export class GeocodificacaoModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(GeocodificacaoController);
  }
}
