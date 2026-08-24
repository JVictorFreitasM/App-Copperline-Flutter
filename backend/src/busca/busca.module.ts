import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { BuscaController } from './busca.controller';
import { BuscaService } from './busca.service';

@Module({
  imports: [PrismaModule],
  controllers: [BuscaController],
  providers: [BuscaService],
})
export class BuscaModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(BuscaController);
  }
}
