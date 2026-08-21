import { BullModule } from '@nestjs/bullmq';
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { SYNC_QUEUE } from '../sync/sync.constants';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { ConfiguracaoSyncEstoqueController } from './configuracao-sync-estoque.controller';
import { ConfiguracaoSyncEstoqueService } from './configuracao-sync-estoque.service';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';

@Module({
  // BullModule.registerQueue com o mesmo nome ja registrado em
  // SyncModule e' seguro/idempotente (BullMQ compartilha a fila via
  // Redis) - precisa daqui tambem pra ConfiguracaoSyncEstoqueService
  // poder injetar a Queue e chamar upsertJobScheduler.
  imports: [PrismaModule, RedisModule, BullModule.registerQueue({ name: SYNC_QUEUE })],
  // ConfiguracaoSyncEstoqueController fica de fora de
  // configure()/.forRoutes(EstoqueController) abaixo de proposito - e' um
  // endpoint administrativo, protegido so por ApiKeyGuard (ver o proprio
  // controller), nao por sessao SSO.
  controllers: [EstoqueController, ConfiguracaoSyncEstoqueController],
  providers: [EstoqueService, RateLimitGuard, ConfiguracaoSyncEstoqueService],
})
export class EstoqueModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(EstoqueController);
  }
}
