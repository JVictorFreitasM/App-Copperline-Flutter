import { Processor, WorkerHost } from '@nestjs/bullmq';
import { NOTIFICACAO_QUEUE } from './notificacao.constants';
import { NotificacaoDispatchService } from './notificacao-dispatch.service';

@Processor(NOTIFICACAO_QUEUE, { concurrency: 1 })
export class NotificacaoProcessor extends WorkerHost {
  constructor(private readonly dispatchService: NotificacaoDispatchService) {
    super();
  }

  async process(): Promise<void> {
    await this.dispatchService.processarPendentes();
  }
}
