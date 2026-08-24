import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { NOTIFICACAO_JOB_NAME, NOTIFICACAO_QUEUE } from './notificacao.constants';

// So enfileira - nenhuma logica de negocio aqui (mesmo espirito de
// SyncScheduler). 1 minuto e' um intervalo curto o bastante pra push
// chegar quase em tempo real, sem gerar carga real (o processamento em si
// so faz algo quando ha EventoNotificacao PENDENTE, ver
// NotificacaoDispatchService).
@Injectable()
export class NotificacaoScheduler {
  constructor(@InjectQueue(NOTIFICACAO_QUEUE) private readonly queue: Queue) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async agendarProcessamento(): Promise<void> {
    await this.queue.add(NOTIFICACAO_JOB_NAME, {});
  }
}
