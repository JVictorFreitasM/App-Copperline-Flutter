import { Global, Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { SegredoCryptoService } from '../common/crypto/segredo-crypto.service';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminProvedoresApiController } from './admin-provedores-api.controller';
import { ProvedoresApiService } from './provedores-api.service';

// Global: CEP, CNPJ e geocodificacao leem a cadeia de provedores daqui.
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AdminProvedoresApiController],
  providers: [ProvedoresApiService, SegredoCryptoService],
  exports: [ProvedoresApiService],
})
export class ProvedoresApiModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth, requireRole('admin'))
      .forRoutes(AdminProvedoresApiController);
  }
}
