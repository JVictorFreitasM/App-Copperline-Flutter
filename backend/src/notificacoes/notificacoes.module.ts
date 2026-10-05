import { BullModule } from '@nestjs/bullmq';
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { PushNotificationClientModule } from '../push-notification-client/push-notification-client.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminGruposMensagemController, AdminMensagensController } from './admin-mensagens.controller';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';
import { FavoritosService } from './favoritos.service';
import { GruposMensagemService } from './grupos-mensagem.service';
import { MensagensNotificacaoService } from './mensagens-notificacao.service';
import { NOTIFICACAO_QUEUE } from './notificacao.constants';
import { NotificacaoDispatchService } from './notificacao-dispatch.service';
import { NotificacaoUsuarioService } from './notificacao-usuario.service';
import { NotificacoesController } from './notificacoes.controller';
import { NotificacaoProcessor } from './notificacao.processor';
import { NotificacaoScheduler } from './notificacao.scheduler';

@Module({
  imports: [
    PrismaModule,
    UsuariosModule,
    PushNotificationClientModule,
    BullModule.registerQueue({ name: NOTIFICACAO_QUEUE }),
  ],
  controllers: [
    DispositivosController,
    NotificacoesController,
    AdminMensagensController,
    AdminGruposMensagemController,
  ],
  providers: [
    DispositivosService,
    // FavoritosService exportado pra ProdutosController (as rotas de
    // favoritos ficam la, nao aqui - ver produtos.controller.ts, motivo:
    // ordem de match de rota contra GET /produtos/:id).
    FavoritosService,
    NotificacaoDispatchService,
    NotificacaoUsuarioService,
    MensagensNotificacaoService,
    GruposMensagemService,
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
      .forRoutes(DispositivosController, NotificacoesController);

    // Mensagens manuais pro app do vendedor + grupos de destinatarios: so'
    // admin (mesmo criterio da tela de Configuracoes).
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth, requireRole('admin'))
      .forRoutes(AdminMensagensController, AdminGruposMensagemController);
  }
}
