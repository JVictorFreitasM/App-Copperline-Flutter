import { BullModule } from '@nestjs/bullmq';
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { PushNotificationClientModule } from '../push-notification-client/push-notification-client.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';
import { FavoritosService } from './favoritos.service';
import { NOTIFICACAO_QUEUE } from './notificacao.constants';
import { NotificacaoDispatchService } from './notificacao-dispatch.service';
import { NotificacaoProcessor } from './notificacao.processor';
import { NotificacaoScheduler } from './notificacao.scheduler';

@Module({
  imports: [
    PrismaModule,
    UsuariosModule,
    PushNotificationClientModule,
    BullModule.registerQueue({ name: NOTIFICACAO_QUEUE }),
  ],
  controllers: [DispositivosController],
  providers: [
    DispositivosService,
    // FavoritosService exportado pra ProdutosController (as rotas de
    // favoritos ficam la, nao aqui - ver produtos.controller.ts, motivo:
    // ordem de match de rota contra GET /produtos/:id).
    FavoritosService,
    NotificacaoDispatchService,
    NotificacaoProcessor,
    NotificacaoScheduler,
  ],
  exports: [FavoritosService],
})
export class NotificacoesModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(DispositivosController);
  }
}
