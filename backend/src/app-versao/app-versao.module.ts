import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { RedisModule } from '../redis/redis.module';
import { AppVersaoController } from './app-versao.controller';
import { AppVersaoService } from './app-versao.service';

@Module({
  imports: [RedisModule],
  controllers: [AppVersaoController],
  providers: [AppVersaoService, RateLimitGuard],
})
export class AppVersaoModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(AppVersaoController);
  }
}
