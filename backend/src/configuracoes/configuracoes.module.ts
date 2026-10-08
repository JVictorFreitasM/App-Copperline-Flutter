import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { ErpClientModule } from '../erp-client/erp-client.module';
import { LlmClientModule } from '../llm-client/llm-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SolicitacoesDescontoModule } from '../solicitacoes-desconto/solicitacoes-desconto.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminConfiguracaoAlcadaAprovacaoController } from './admin-configuracao-alcada-aprovacao.controller';
import { AdminCredenciaisErpController } from './admin-credenciais-erp.controller';
import { AdminConfiguracaoDocumentoPedidoController } from './admin-configuracao-documento-pedido.controller';
import { AdminConfiguracaoFuncionalidadesController } from './admin-configuracao-funcionalidades.controller';
import { AdminConfiguracaoLlmController } from './admin-configuracao-llm.controller';
import { AdminConfiguracaoOrcamentoController } from './admin-configuracao-orcamento.controller';
import { AdminConfiguracaoRastreioController } from './admin-configuracao-rastreio.controller';
import { ComunicadoPedidoPdfService } from './comunicado-pedido-pdf.service';
import { ConfiguracaoFuncionalidadesService } from './configuracao-funcionalidades.service';
import { ConfiguracaoOrcamentoService } from './configuracao-orcamento.service';
import { ConfiguracaoRastreioService } from './configuracao-rastreio.service';
import { DadosEmpresaPdfService } from './dados-empresa-pdf.service';
import { FuncionalidadesController } from './funcionalidades.controller';
import { VendedorHorarioTrabalhoController } from './vendedor-horario-trabalho.controller';
import { VendedorHorarioTrabalhoService } from './vendedor-horario-trabalho.service';

// Tela de Configuracoes (Epico 4, OS-dashboard-configuracoes-notificacoes-
// auditoria.md) - 4 abas (LLM desde 2026-09-24, unificada aqui - antes
// vivia sozinha em /admin/llm com ApiKeyGuard), cada uma com endpoint
// GET/PATCH proprio, todas protegidas por requireAuth + requireRole('admin')
// (icone no topbar so visivel/util pra quem tem esse papel). "Alcada de
// Aprovacao" reaproveita ConfiguracaoDescontoService do
// SolicitacoesDescontoModule (mesma tabela, mesma regra) - so' Orcamento/
// Rastreio/LLM tem service+tabela genuinamente novos.
@Module({
  imports: [PrismaModule, SolicitacoesDescontoModule, UsuariosModule, LlmClientModule, ErpClientModule],
  controllers: [
    AdminConfiguracaoAlcadaAprovacaoController,
    AdminConfiguracaoOrcamentoController,
    AdminConfiguracaoRastreioController,
    AdminConfiguracaoLlmController,
    AdminConfiguracaoDocumentoPedidoController,
    AdminConfiguracaoFuncionalidadesController,
    AdminCredenciaisErpController,
    FuncionalidadesController,
    // VendedorHorarioTrabalhoController fica FORA do requireRole('admin')
    // abaixo, de proposito - e' o proprio vendedor editando o horario
    // dele, nao uma tela de admin (ver seu comentario sobre por que vive
    // neste modulo mesmo assim).
    VendedorHorarioTrabalhoController,
  ],
  providers: [
    ConfiguracaoOrcamentoService,
    ConfiguracaoFuncionalidadesService,
    ConfiguracaoRastreioService,
    VendedorHorarioTrabalhoService,
    DadosEmpresaPdfService,
    ComunicadoPedidoPdfService,
  ],
  // Exportados pra outros modulos consumirem os valores de verdade
  // (VisitasModule/PedidosModule/RastreioModule/MobileModule le
  // ConfiguracaoRastreioService; PedidosModule/CriarPedidoService le
  // ConfiguracaoOrcamentoService, incluindo permitirItensRepetidos;
  // PedidosModule/PedidoPdfService le DadosEmpresaPdfService/
  // ComunicadoPedidoPdfService pro cabecalho/2a pagina do PDF).
  exports: [
    ConfiguracaoOrcamentoService,
    ConfiguracaoFuncionalidadesService,
    ConfiguracaoRastreioService,
    DadosEmpresaPdfService,
    ComunicadoPedidoPdfService,
  ],
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
        AdminConfiguracaoLlmController,
        AdminConfiguracaoDocumentoPedidoController,
        AdminConfiguracaoFuncionalidadesController,
        AdminCredenciaisErpController,
      );

    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(VendedorHorarioTrabalhoController, FuncionalidadesController);
  }
}
