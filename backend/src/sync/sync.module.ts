import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ErpClientModule } from '../erp-client/erp-client.module';
import { EstoqueSvcClientModule } from '../estoque-svc-client/estoque-svc-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClienteSyncStrategy } from './strategies/cliente.sync';
import { NotaFiscalSyncStrategy } from './strategies/nota-fiscal.sync';
import { PedidoSyncStrategy } from './strategies/pedido.sync';
import { ProdutoSyncStrategy } from './strategies/produto.sync';
import { SaldoEstoqueSyncStrategy } from './strategies/saldo-estoque.sync';
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
  ],
  providers: [
    ClienteSyncStrategy,
    ProdutoSyncStrategy,
    PedidoSyncStrategy,
    NotaFiscalSyncStrategy,
    SaldoEstoqueSyncStrategy,
    VendedorSyncStrategy,
    {
      // Lista de strategies disponiveis para o SyncService/SyncScheduler -
      // adicionar uma nova entidade e so incluir a strategy aqui, sem
      // tocar em sync.service.ts/sync.scheduler.ts/sync.processor.ts.
      // SaldoEstoqueSyncStrategy tambem entra aqui normalmente
      // (SyncService.executar precisa encontra-la) - o que a diferencia
      // e' agendamento:'CONFIGURAVEL' (ver saldo-estoque.sync.ts), que faz
      // o SyncScheduler ignora-la nos tres @Cron fixos.
      provide: SYNC_STRATEGIES,
      useFactory: (
        cliente: ClienteSyncStrategy,
        produto: ProdutoSyncStrategy,
        pedido: PedidoSyncStrategy,
        notaFiscal: NotaFiscalSyncStrategy,
        saldoEstoque: SaldoEstoqueSyncStrategy,
        vendedor: VendedorSyncStrategy,
      ) => [cliente, produto, pedido, notaFiscal, saldoEstoque, vendedor],
      inject: [
        ClienteSyncStrategy,
        ProdutoSyncStrategy,
        PedidoSyncStrategy,
        NotaFiscalSyncStrategy,
        SaldoEstoqueSyncStrategy,
        VendedorSyncStrategy,
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
