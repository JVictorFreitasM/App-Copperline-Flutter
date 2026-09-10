import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTabelasPrecoController } from './admin-tabelas-preco.controller';
import { ConfiguracaoTabelaPrecoService } from './configuracao-tabela-preco.service';
import { PrecoProdutoService } from './preco-produto.service';
import { TabelasPrecoController } from './tabelas-preco.controller';
import { TabelasPrecoService } from './tabelas-preco.service';

@Module({
  imports: [PrismaModule],
  controllers: [TabelasPrecoController, AdminTabelasPrecoController],
  providers: [TabelasPrecoService, PrecoProdutoService, ConfiguracaoTabelaPrecoService],
  // PrecoProdutoService exportado pra ProdutosModule/EstoqueModule
  // mostrarem o preco vindo da tabela selecionada sem duplicar a
  // resolucao. ConfiguracaoTabelaPrecoService exportado pro SyncModule
  // (TabelaPrecoSyncStrategy le qual codigo sincronizar).
  exports: [PrecoProdutoService, ConfiguracaoTabelaPrecoService],
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
