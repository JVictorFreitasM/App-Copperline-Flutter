import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminProdutosController } from './admin-produtos.controller';
import { ProdutoCalculoService } from './produto-calculo.service';
import { ProdutoImagemStorageService } from './produto-imagem-storage.service';
import { ProdutoManualService } from './produto-manual.service';
import { ProdutosController } from './produtos.controller';
import { ProdutosRupturaService } from './produtos-ruptura.service';
import { ProdutosService } from './produtos.service';

@Module({
  // NotificacoesModule/UsuariosModule importados so pelas rotas de
  // favoritos em ProdutosController (ver comentario la - ficaram aqui em
  // vez de num controller proprio pra garantir a ordem de match de rota
  // contra GET /produtos/:id, ver OS-BACKEND-19).
  imports: [PrismaModule, NotificacoesModule, UsuariosModule],
  controllers: [ProdutosController, AdminProdutosController],
  providers: [
    ProdutosService,
    ProdutosRupturaService,
    ProdutoCalculoService,
    ProdutoManualService,
    ProdutoImagemStorageService,
  ],
  // ProdutoCalculoService exportado pra PedidosModule (OS-BACKEND-25)
  // reaproveitar o calculo por tipo de venda na criacao de pedido.
  exports: [ProdutoCalculoService],
})
export class ProdutosModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    // Leitura (listar/detalhe/calcular/imagem) - qualquer vendedor
    // autenticado.
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(ProdutosController);

    // Edicao de dado proprio do catalogo (precoFabricacao/imagem) -
    // autenticado E role admin (mesmo criterio de AdminDocumentosController).
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth, requireRole('admin'))
      .forRoutes(AdminProdutosController);
  }
}
