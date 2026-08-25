import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminConfiguracaoDescontoController } from './admin-configuracao-desconto.controller';
import { ConfiguracaoDescontoService } from './configuracao-desconto.service';
import { SolicitacoesDescontoController } from './solicitacoes-desconto.controller';
import { SolicitacoesDescontoService } from './solicitacoes-desconto.service';

@Module({
  imports: [PrismaModule, UsuariosModule],
  // AdminConfiguracaoDescontoController fica protegido so por ApiKeyGuard
  // (ver seu proprio @UseGuards) - so SolicitacoesDescontoController entra
  // no requireAuth abaixo.
  controllers: [SolicitacoesDescontoController, AdminConfiguracaoDescontoController],
  providers: [SolicitacoesDescontoService, ConfiguracaoDescontoService],
  exports: [SolicitacoesDescontoService, ConfiguracaoDescontoService],
})
export class SolicitacoesDescontoModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(SolicitacoesDescontoController);
  }
}
