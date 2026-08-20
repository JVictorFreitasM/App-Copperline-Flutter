import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ErpClientModule } from '../erp-client/erp-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClienteSyncStrategy } from './strategies/cliente.sync';
import { NotaFiscalSyncStrategy } from './strategies/nota-fiscal.sync';
import { PedidoSyncStrategy } from './strategies/pedido.sync';
import { ProdutoSyncStrategy } from './strategies/produto.sync';
import { SYNC_QUEUE, SYNC_STRATEGIES } from './sync.constants';
import { SyncProcessor } from './sync.processor';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: SYNC_QUEUE }),
    PrismaModule,
    ErpClientModule,
  ],
  providers: [
    ClienteSyncStrategy,
    ProdutoSyncStrategy,
    PedidoSyncStrategy,
    NotaFiscalSyncStrategy,
    {
      // Lista de strategies disponiveis para o SyncService/SyncScheduler -
      // adicionar uma nova entidade e so incluir a strategy aqui, sem
      // tocar em sync.service.ts/sync.scheduler.ts/sync.processor.ts.
      provide: SYNC_STRATEGIES,
      useFactory: (
        cliente: ClienteSyncStrategy,
        produto: ProdutoSyncStrategy,
        pedido: PedidoSyncStrategy,
        notaFiscal: NotaFiscalSyncStrategy,
      ) => [cliente, produto, pedido, notaFiscal],
      inject: [
        ClienteSyncStrategy,
        ProdutoSyncStrategy,
        PedidoSyncStrategy,
        NotaFiscalSyncStrategy,
      ],
    },
    SyncService,
    SyncProcessor,
    SyncScheduler,
  ],
})
export class SyncModule {}
