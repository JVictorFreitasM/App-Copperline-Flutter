import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PedidosModule } from '../pedidos/pedidos.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RastreioModule } from '../rastreio/rastreio.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { VisitasModule } from '../visitas/visitas.module';
import { FilaPendenteService } from './fila-pendente.service';
import { MobileController } from './mobile.controller';
import { MobileSnapshotService } from './mobile-snapshot.service';

@Module({
  // Nenhuma regra de negocio propria aqui - so orquestra os modulos ja
  // existentes (pedido/visita/rastreio/escopo por vendedor), ver
  // FilaPendenteService/MobileSnapshotService.
  imports: [
    PrismaModule,
    UsuariosModule,
    VendedoresModule,
    PedidosModule,
    VisitasModule,
    RastreioModule,
  ],
  controllers: [MobileController],
  providers: [MobileSnapshotService, FilaPendenteService],
})
export class MobileModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(MobileController);
  }
}
