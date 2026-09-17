import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPagamentoController } from './admin-pagamento.controller';
import { PagamentoController } from './pagamento.controller';
import { PagamentoService } from './pagamento.service';

@Module({
  imports: [PrismaModule],
  controllers: [PagamentoController, AdminPagamentoController],
  providers: [PagamentoService],
})
export class PagamentoModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(PagamentoController);

    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth, requireRole('admin'))
      .forRoutes(AdminPagamentoController);
  }
}
