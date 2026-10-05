import { Processor, WorkerHost } from '@nestjs/bullmq';
import { MENSAGEM_PERIODICA_QUEUE } from './notificacao.constants';
import { MensagensPeriodicasService } from './mensagens-periodicas.service';

@Processor(MENSAGEM_PERIODICA_QUEUE, { concurrency: 1 })
export class MensagemPeriodicaProcessor extends WorkerHost {
  constructor(private readonly mensagensPeriodicasService: MensagensPeriodicasService) {
    super();
  }

  async process(): Promise<void> {
    await this.mensagensPeriodicasService.executarDevidas();
  }
}
