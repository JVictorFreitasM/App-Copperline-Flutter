import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EmpresarialSvcClientModule } from '../empresarial-svc-client/empresarial-svc-client.module';
import { ErpClientModule } from '../erp-client/erp-client.module';
import { EstoqueSvcClientModule } from '../estoque-svc-client/estoque-svc-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TabelasPrecoModule } from '../tabelas-preco/tabelas-preco.module';
import { ClienteSyncStrategy } from './strategies/cliente.sync';
import { CondicaoPagamentoSyncStrategy } from './strategies/condicao-pagamento.sync';
import { FormaPagamentoSyncStrategy } from './strategies/forma-pagamento.sync';
import { NotaFiscalSyncStrategy } from './strategies/nota-fiscal.sync';
import { PedidoSyncStrategy } from './strategies/pedido.sync';
import { ProdutoSyncStrategy } from './strategies/produto.sync';
import { SaldoEstoqueSyncStrategy } from './strategies/saldo-estoque.sync';
import { TabelaPrecoSyncStrategy } from './strategies/tabela-preco.sync';
import { VendedorSyncStrategy } from './strategies/vendedor.sync';
import { SyncConfigService } from './sync-config.service';
import { SyncObservabilityService } from './sync-observability.service';
import { SYNC_QUEUE, SYNC_STRATEGIES } from './sync.constants';
import { SyncProcessor } from './sync.processor';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: SYNC_QUEUE }),
    PrismaModule,
    ErpClientModule,
    EstoqueSvcClientModule,
    EmpresarialSvcClientModule,
    TabelasPrecoModule,
  ],
  providers: [
    ClienteSyncStrategy,
    ProdutoSyncStrategy,
    PedidoSyncStrategy,
    NotaFiscalSyncStrategy,
    SaldoEstoqueSyncStrategy,
    VendedorSyncStrategy,
    TabelaPrecoSyncStrategy,
    FormaPagamentoSyncStrategy,
    CondicaoPagamentoSyncStrategy,
    {
      // Lista de strategies disponiveis para o SyncService/SyncScheduler -
      // adicionar uma nova entidade e so incluir a strategy aqui, sem
      // tocar em sync.service.ts/sync.scheduler.ts/sync.processor.ts.
      // SaldoEstoqueSyncStrategy/TabelaPrecoSyncStrategy tambem entram
      // aqui normalmente (SyncService.executar precisa encontra-las) - o
      // que as diferencia e' agendamento:'CONFIGURAVEL' (ver
      // saldo-estoque.sync.ts), que faz o SyncScheduler ignora-las nos
      // tres @Cron fixos.
      provide: SYNC_STRATEGIES,
      useFactory: (
        cliente: ClienteSyncStrategy,
        produto: ProdutoSyncStrategy,
        pedido: PedidoSyncStrategy,
        notaFiscal: NotaFiscalSyncStrategy,
        saldoEstoque: SaldoEstoqueSyncStrategy,
        vendedor: VendedorSyncStrategy,
        tabelaPreco: TabelaPrecoSyncStrategy,
        formaPagamento: FormaPagamentoSyncStrategy,
        condicaoPagamento: CondicaoPagamentoSyncStrategy,
      ) => [
        cliente,
        produto,
        pedido,
        notaFiscal,
        saldoEstoque,
        vendedor,
        tabelaPreco,
        formaPagamento,
        condicaoPagamento,
      ],
      inject: [
        ClienteSyncStrategy,
        ProdutoSyncStrategy,
        PedidoSyncStrategy,
        NotaFiscalSyncStrategy,
        SaldoEstoqueSyncStrategy,
        VendedorSyncStrategy,
        TabelaPrecoSyncStrategy,
        FormaPagamentoSyncStrategy,
        CondicaoPagamentoSyncStrategy,
      ],
    },
    SyncService,
    SyncProcessor,
    SyncScheduler,
    SyncConfigService,
    SyncObservabilityService,
  ],
  // Exportados pra AdminSyncModule (OS-BACKEND-15/16) montar os endpoints
  // de configuracao/disparo manual/observabilidade sem duplicar o acesso a
  // SYNC_STRATEGIES/fila/Prisma que este modulo ja monta.
  exports: [SyncConfigService, SyncObservabilityService],
})
export class SyncModule {}
