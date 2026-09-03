import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { LlmClientModule } from '../llm-client/llm-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { ComparativoVendedoresService } from './comparativo-vendedores.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SazonalidadeService } from './sazonalidade.service';

@Module({
  // LlmClientModule/RedisModule importados so pelo GET /dashboard/sazonalidade
  // (OS-BACKEND-49) - mesmo padrao de cache/IA ja usado em ClienteResumoLlmService.
  // VendedoresModule so' pelo VendedorVendasService (OS-WEB-40, comparativo
  // de vendedores) - mesmo reaproveitamento ja feito por MetasModule.
  imports: [PrismaModule, LlmClientModule, RedisModule, VendedoresModule],
  controllers: [DashboardController],
  providers: [DashboardService, SazonalidadeService, ComparativoVendedoresService],
})
export class DashboardModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(DashboardController);
  }
}
