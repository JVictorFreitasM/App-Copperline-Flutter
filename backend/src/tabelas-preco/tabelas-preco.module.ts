import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTabelasPrecoController } from './admin-tabelas-preco.controller';
import { PrecoProdutoService } from './preco-produto.service';
import { TabelasPrecoController } from './tabelas-preco.controller';
import { TabelasPrecoService } from './tabelas-preco.service';

@Module({
  imports: [PrismaModule],
  controllers: [TabelasPrecoController, AdminTabelasPrecoController],
  providers: [TabelasPrecoService, PrecoProdutoService],
  // PrecoProdutoService exportado pra ProdutosModule/EstoqueModule
  // mostrarem o preco vindo da tabela padrao sem duplicar a resolucao.
  exports: [PrecoProdutoService],
})
export class TabelasPrecoModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(TabelasPrecoController);

    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth, requireRole('admin'))
      .forRoutes(AdminTabelasPrecoController);
  }
}
