import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { MENSAGEM_PERIODICA_JOB_NAME, MENSAGEM_PERIODICA_QUEUE } from './notificacao.constants';

// So enfileira - nenhuma logica de negocio aqui (mesmo espirito dos outros
// schedulers). Roda a cada minuto porque o horario da mensagem e' em
// minutos (HH:mm); quem decide O QUE esta vencida e' o service
// (proximoEnvioEm <= agora), entao o fuso do cron e' irrelevante.
@Injectable()
export class MensagemPeriodicaScheduler {
  constructor(@InjectQueue(MENSAGEM_PERIODICA_QUEUE) private readonly queue: Queue) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async agendar(): Promise<void> {
    // jobId fixo por minuto: se um tick atrasar e outro chegar junto, o
    // BullMQ descarta o duplicado em vez de enfileirar dois. Sem ':' no id -
    // o BullMQ recusa ("Custom Id cannot contain :") e o cron falharia em
    // silencio todo minuto.
    const minuto = Math.floor(Date.now() / 60_000);
    await this.queue.add(MENSAGEM_PERIODICA_JOB_NAME, {}, {
      jobId: `${MENSAGEM_PERIODICA_JOB_NAME}-${minuto}`,
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
