import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { AdminGamificacaoController, AdminMetasController } from './admin-metas.controller';
import { ConfiguracaoGamificacaoService } from './configuracao-gamificacao.service';
import { MetaVendedorService } from './meta-vendedor.service';
import { MetasController } from './metas.controller';
import { RankingEquipeService } from './ranking-equipe.service';

// OS-BACKEND-44 - metas mensais por vendedor + ranking de equipe.
// AdminMetasController/AdminGamificacaoController (ApiKeyGuard, escrita)
// ficam fora do requireAuth abaixo - mesmo criterio de AdminVendedoresController.
// VendedorVendasService vem de VendedoresModule (exportado de la, ver seu
// comentario) - nao redeclarado aqui como provider, senao o Nest criaria
// uma segunda instancia separada da usada pelo dashboard.
@Module({
  imports: [PrismaModule, UsuariosModule, VendedoresModule],
  controllers: [MetasController, AdminMetasController, AdminGamificacaoController],
  providers: [MetaVendedorService, RankingEquipeService, ConfiguracaoGamificacaoService],
})
export class MetasModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(MetasController);
  }
}
