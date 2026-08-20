import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { NotasFiscaisController } from './notas-fiscais.controller';
import { NotasFiscaisService } from './notas-fiscais.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotasFiscaisController],
  providers: [NotasFiscaisService],
})
export class NotasFiscaisModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(NotasFiscaisController);
  }
}
