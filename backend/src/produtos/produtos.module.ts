import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';

@Module({
  // NotificacoesModule/UsuariosModule importados so pelas rotas de
  // favoritos em ProdutosController (ver comentario la - ficaram aqui em
  // vez de num controller proprio pra garantir a ordem de match de rota
  // contra GET /produtos/:id, ver OS-BACKEND-19).
  imports: [PrismaModule, NotificacoesModule, UsuariosModule],
  controllers: [ProdutosController],
  providers: [ProdutosService],
})
export class ProdutosModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(ProdutosController);
  }
}
