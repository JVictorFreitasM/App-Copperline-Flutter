import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';

// Configuracao/disparo manual da sincronizacao de saldo de estoque saiu
// daqui (OS-BACKEND-15) - generalizado em AdminSyncModule
// (GET/PATCH /admin/sync/configuracoes, POST .../executar-agora), que
// cobre saldo_estoque junto com as demais entidades sincronizadas.
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [EstoqueController],
  providers: [EstoqueService, RateLimitGuard],
})
export class EstoqueModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(EstoqueController);
  }
}
