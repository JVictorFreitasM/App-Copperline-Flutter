import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { LlmClientModule } from '../llm-client/llm-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { OportunidadeClienteService } from './oportunidade-cliente.service';
import { OportunidadesController } from './oportunidades.controller';

// OS-BACKEND-45 - reaproveita LlmClientModule (OS-BACKEND-20) e RedisModule
// (mesmo padrao de cache 24h de ClienteResumoLlmService).
@Module({
  imports: [PrismaModule, LlmClientModule, RedisModule, UsuariosModule, VendedoresModule],
  controllers: [OportunidadesController],
  providers: [OportunidadeClienteService],
})
export class OportunidadesModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(OportunidadesController);
  }
}
