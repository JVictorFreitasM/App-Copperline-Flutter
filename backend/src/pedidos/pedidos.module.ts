import { BullModule } from '@nestjs/bullmq';
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module';
import { ErpClientModule } from '../erp-client/erp-client.module';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { IdempotenciaAcaoModule } from '../idempotencia-acao/idempotencia-acao.module';
import { RELATORIO_DIARIO_QUEUE } from '../notificacoes/notificacao.constants';
import { RelatorioDiarioNotificacaoProcessor } from '../notificacoes/relatorio-diario-notificacao.processor';
import { RelatorioDiarioNotificacaoScheduler } from '../notificacoes/relatorio-diario-notificacao.scheduler';
import { RelatorioDiarioNotificacaoService } from '../notificacoes/relatorio-diario-notificacao.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { SolicitacoesDescontoModule } from '../solicitacoes-desconto/solicitacoes-desconto.module';
import { TabelasPrecoModule } from '../tabelas-preco/tabelas-preco.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { CriarPedidoIdempotenteService } from './criar-pedido-idempotente.service';
import { CriarPedidoService } from './criar-pedido.service';
import { PedidoErpClientService } from './pedido-erp-client.service';
import { PedidoPdfService } from './pedido-pdf.service';
import { DecisaoDescontoPedidoService } from './decisao-desconto-pedido.service';
import { DecisaoSolicitacaoDescontoController } from './decisao-solicitacao-desconto.controller';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { RelatorioPedidosService } from './relatorio-pedidos.service';

@Module({
  // ProdutosModule (calculo por tipo de venda), SolicitacoesDescontoModule
  // (regra de aprovacao), UsuariosModule/VendedoresModule (escopo por
  // vendedor), TabelasPrecoModule (tabela selecionada pro envio ao ERP) e
  // ErpClientModule (PedidoErpClientService, OS-BACKEND-25) - todos
  // reaproveitados de OS's anteriores, ver criar-pedido.service.ts.
  //
  // RelatorioDiarioNotificacao* (pedido do usuario, 2026-09-29) vive AQUI
  // (nao em NotificacoesModule) de proposito - depende de
  // RelatorioPedidosService (mesmo modulo, DI direta) e so cria
  // EventoNotificacao (funcao pura importada de
  // notificacoes/evento-notificacao.service.ts, sem precisar importar o
  // modulo inteiro); importar NotificacoesModule aqui criaria ciclo
  // (PedidosModule -> ProdutosModule -> NotificacoesModule -> PedidosModule).
  // Fila propria (RELATORIO_DIARIO_QUEUE), separada da fila de
  // NotificacoesModule.
  imports: [
    PrismaModule,
    IdempotenciaAcaoModule,
    ProdutosModule,
    SolicitacoesDescontoModule,
    TabelasPrecoModule,
    UsuariosModule,
    VendedoresModule,
    ErpClientModule,
    ConfiguracoesModule,
    BullModule.registerQueue({ name: RELATORIO_DIARIO_QUEUE }),
  ],
  controllers: [PedidosController, DecisaoSolicitacaoDescontoController],
  providers: [
    PedidosService,
    CriarPedidoService,
    CriarPedidoIdempotenteService,
    DecisaoDescontoPedidoService,
    PedidoErpClientService,
    RelatorioPedidosService,
    PedidoPdfService,
    RelatorioDiarioNotificacaoService,
    RelatorioDiarioNotificacaoProcessor,
    RelatorioDiarioNotificacaoScheduler,
  ],
  // CriarPedidoService exportado pra MobileModule (OS-BACKEND-29)
  // reaproveitar na fila de acoes offline.
  exports: [CriarPedidoService],
})
export class PedidosModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(PedidosController, DecisaoSolicitacaoDescontoController);
  }
}
