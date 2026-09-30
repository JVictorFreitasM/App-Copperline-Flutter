import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { RELATORIO_DIARIO_JOB_NAME, RELATORIO_DIARIO_QUEUE } from './notificacao.constants';

// So enfileira - nenhuma logica de negocio aqui (mesmo espirito de
// NotificacaoScheduler/SyncScheduler). Pedido do usuario (2026-09-29):
// dois disparos por dia util (segunda a sexta, "1-5"), manha (o que
// precisa de acao pra comecar o dia) e fim de expediente (balanco do
// dia) - ver RelatorioDiarioNotificacaoService pro texto de cada um.
//
// timeZone explicito de proposito - os outros @Cron do projeto
// (SyncScheduler/NotificacaoScheduler) rodam sem essa opcao, o que os
// deixa presos ao horario do CONTAINER (UTC, sem TZ setada no
// docker-compose.yml - confirmado 2026-09-29). Pra job de sync isso e'
// inofensivo (so importa "de tempos em tempos"), mas aqui o horario em si
// E' o requisito (7h/18h de Brasilia pro vendedor, nao 7h/18h UTC = 4h/15h
// local) - sem isso, o push saira 3h adiantado.
@Injectable()
export class RelatorioDiarioNotificacaoScheduler {
  constructor(@InjectQueue(RELATORIO_DIARIO_QUEUE) private readonly queue: Queue) {}

  @Cron('0 7 * * 1-5', { timeZone: 'America/Sao_Paulo' })
  async agendarManha(): Promise<void> {
    await this.queue.add(RELATORIO_DIARIO_JOB_NAME, { momento: 'MANHA' });
  }

  @Cron('0 18 * * 1-5', { timeZone: 'America/Sao_Paulo' })
  async agendarFimDeDia(): Promise<void> {
    await this.queue.add(RELATORIO_DIARIO_JOB_NAME, { momento: 'FIM_DIA' });
  }
}
