import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { SolicitacoesDescontoModule } from '../solicitacoes-desconto/solicitacoes-desconto.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { CriarPedidoService } from './criar-pedido.service';
import { PedidoErpClientService } from './pedido-erp-client.service';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  // ProdutosModule (calculo por tipo de venda), SolicitacoesDescontoModule
  // (regra de aprovacao) e UsuariosModule/VendedoresModule (escopo por
  // vendedor) - todos reaproveitados de OS's anteriores, ver
  // criar-pedido.service.ts.
  imports: [
    PrismaModule,
    ProdutosModule,
    SolicitacoesDescontoModule,
    UsuariosModule,
    VendedoresModule,
  ],
  controllers: [PedidosController],
  providers: [PedidosService, CriarPedidoService, PedidoErpClientService],
})
export class PedidosModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(PedidosController);
  }
}
