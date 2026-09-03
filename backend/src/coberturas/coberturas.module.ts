import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { LlmClientModule } from '../llm-client/llm-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminCoberturasController } from './admin-coberturas.controller';
import { CoberturaResumoService } from './cobertura-resumo.service';
import { CoberturaTemporariaService } from './cobertura-temporaria.service';
import { CoberturasController } from './coberturas.controller';

// OS-BACKEND-48 - AdminCoberturasController (ApiKeyGuard, criar/listar)
// fica fora do requireAuth abaixo - mesmo criterio de AdminVendedoresController.
@Module({
  imports: [PrismaModule, LlmClientModule, RedisModule, UsuariosModule],
  controllers: [CoberturasController, AdminCoberturasController],
  providers: [CoberturaTemporariaService, CoberturaResumoService],
})
export class CoberturasModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(CoberturasController);
  }
}
