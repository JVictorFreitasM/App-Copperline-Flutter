import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminRastreioController } from './admin-rastreio.controller';
import { RastreioController } from './rastreio.controller';
import { RastreioService } from './rastreio.service';

@Module({
  imports: [PrismaModule, UsuariosModule],
  // AdminRastreioController fica protegido so por ApiKeyGuard (ver seu
  // proprio @UseGuards) - so RastreioController entra no requireAuth abaixo.
  controllers: [RastreioController, AdminRastreioController],
  providers: [RastreioService],
})
export class RastreioModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(RastreioController);
  }
}
