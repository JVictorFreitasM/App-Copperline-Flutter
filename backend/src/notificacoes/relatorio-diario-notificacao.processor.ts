import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { RELATORIO_DIARIO_QUEUE } from './notificacao.constants';
import {
  RelatorioDiarioNotificacaoService,
  type MomentoRelatorioDiario,
} from './relatorio-diario-notificacao.service';

@Processor(RELATORIO_DIARIO_QUEUE, { concurrency: 1 })
export class RelatorioDiarioNotificacaoProcessor extends WorkerHost {
  constructor(private readonly relatorioDiarioNotificacaoService: RelatorioDiarioNotificacaoService) {
    super();
  }

  async process(job: Job<{ momento: MomentoRelatorioDiario }>): Promise<void> {
    await this.relatorioDiarioNotificacaoService.gerar(job.data.momento);
  }
}
