import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTiposAcondicionamentoController } from './admin-tipos-acondicionamento.controller';
import { TiposAcondicionamentoController } from './tipos-acondicionamento.controller';
import { TiposAcondicionamentoService } from './tipos-acondicionamento.service';

@Module({
  imports: [PrismaModule],
  controllers: [TiposAcondicionamentoController, AdminTiposAcondicionamentoController],
  providers: [TiposAcondicionamentoService],
})
export class TiposAcondicionamentoModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(TiposAcondicionamentoController);

    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth, requireRole('admin'))
      .forRoutes(AdminTiposAcondicionamentoController);
  }
}
