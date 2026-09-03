import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminVendedoresController } from './admin-vendedores.controller';
import { VendedoresController } from './vendedores.controller';
import { VendedorEscopoService } from './vendedor-escopo.service';
import { VendedorVendasSemanaisService } from './vendedor-vendas-semanais.service';
import { VendedorVendasService } from './vendedor-vendas.service';
import { VendedoresHierarquiaService } from './vendedores-hierarquia.service';

@Module({
  imports: [PrismaModule, UsuariosModule, RedisModule],
  // AdminVendedoresController fica protegido so por ApiKeyGuard (ver seu
  // proprio @UseGuards) - so VendedoresController (GET /vendedores/me,
  // OS-WEB-21) entra no requireAuth abaixo.
  controllers: [AdminVendedoresController, VendedoresController],
  providers: [
    VendedoresHierarquiaService,
    VendedorEscopoService,
    VendedorVendasService,
    VendedorVendasSemanaisService,
  ],
  // VendedorEscopoService exportado pra ClientesModule (OS-BACKEND-23) e
  // SolicitacoesDescontoModule (OS-WEB-21) resolverem escopo sem duplicar a
  // logica de hierarquia/papel aqui. VendedorVendasService exportado pro
  // DashboardModule (ranking do painel) e MetasModule (OS-BACKEND-44)
  // reaproveitarem a mesma atribuicao de venda por vendedor.
  exports: [VendedorEscopoService, VendedorVendasService],
})
export class VendedoresModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(VendedoresController);
  }
}
