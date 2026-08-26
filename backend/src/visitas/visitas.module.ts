import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { AdminVisitasController } from './admin-visitas.controller';
import { VisitaFotoStorageService } from './visita-foto-storage.service';
import { VisitasController } from './visitas.controller';
import { VisitasService } from './visitas.service';

@Module({
  // VendedoresModule so pra reaproveitar VendedorEscopoService (OS-WEB-26,
  // GET /visitas* escopado por hierarquia) - mesmo raciocinio de
  // ClientesModule/SolicitacoesDescontoModule/RastreioModule.
  imports: [PrismaModule, UsuariosModule, VendedoresModule],
  // AdminVisitasController fica protegido so por ApiKeyGuard (ver seu
  // proprio @UseGuards) - so VisitasController entra no requireAuth abaixo.
  controllers: [VisitasController, AdminVisitasController],
  providers: [VisitasService, VisitaFotoStorageService],
  // VisitasService exportado pra ClientesModule (OS-BACKEND-28) montar
  // GET /clientes/:id/visitas sem duplicar a logica de listagem aqui.
  exports: [VisitasService],
})
export class VisitasModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(VisitasController);
  }
}
