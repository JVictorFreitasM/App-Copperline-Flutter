import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { SolicitacoesDescontoModule } from '../solicitacoes-desconto/solicitacoes-desconto.module';
import { AdminConfiguracaoAlcadaAprovacaoController } from './admin-configuracao-alcada-aprovacao.controller';
import { AdminConfiguracaoOrcamentoController } from './admin-configuracao-orcamento.controller';
import { AdminConfiguracaoRastreioController } from './admin-configuracao-rastreio.controller';
import { ConfiguracaoOrcamentoService } from './configuracao-orcamento.service';
import { ConfiguracaoRastreioService } from './configuracao-rastreio.service';

// Tela de Configuracoes (Epico 4, OS-dashboard-configuracoes-notificacoes-
// auditoria.md) - 3 abas, cada uma com endpoint GET/PATCH proprio, todas
// protegidas por requireAuth + requireRole('admin') (icone no topbar so
// visivel/util pra quem tem esse papel). "Alcada de Aprovacao" reaproveita
// ConfiguracaoDescontoService do SolicitacoesDescontoModule (mesma tabela,
// mesma regra) - so' Orcamento/Rastreio tem service+tabela genuinamente
// novos.
@Module({
  imports: [PrismaModule, SolicitacoesDescontoModule],
  controllers: [
    AdminConfiguracaoAlcadaAprovacaoController,
    AdminConfiguracaoOrcamentoController,
    AdminConfiguracaoRastreioController,
  ],
  providers: [ConfiguracaoOrcamentoService, ConfiguracaoRastreioService],
})
export class ConfiguracoesModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth, requireRole('admin'))
      .forRoutes(
        AdminConfiguracaoAlcadaAprovacaoController,
        AdminConfiguracaoOrcamentoController,
        AdminConfiguracaoRastreioController,
      );
  }
}
