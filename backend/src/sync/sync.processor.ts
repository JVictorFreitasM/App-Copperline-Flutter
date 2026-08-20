import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SYNC_QUEUE } from './sync.constants';
import { SyncService } from './sync.service';

interface SyncJobData {
  nomeEntidade: string;
}

// WorkerHost do BullMQ (ver skill nestjs) - so consome a fila e delega ao
// SyncService, nenhuma logica de negocio aqui. Concurrency 1: a Radar.API do
// WK Radar tem throttling de 4 req/s (ver skill wk-radar-client) - rodar as
// entidades em sequencia evita somar chamadas paralelas contra o mesmo
// limite.
@Processor(SYNC_QUEUE, { concurrency: 1 })
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    this.logger.log(`Processando sincronizacao de '${job.data.nomeEntidade}'`);
    await this.syncService.executar(job.data.nomeEntidade);
  }
}
