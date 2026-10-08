import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { CredenciaisErpService } from '../credenciais-erp/credenciais-erp.service';
import { ehMomentoDoRelatorio, horarioOuPadrao } from './domain/horario-relatorio';
import { RELATORIO_DIARIO_JOB_NAME, RELATORIO_DIARIO_QUEUE } from './notificacao.constants';

const HORARIO_PADRAO_MANHA = '07:00';
const HORARIO_PADRAO_FIM_DIA = '18:00';

// So enfileira - nenhuma logica de negocio aqui (mesmo espirito de
// NotificacaoScheduler/SyncScheduler). Pedido do usuario (2026-09-29): dois
// disparos por dia util (segunda a sexta), manha (o que precisa de acao pra
// comecar o dia) e fim de expediente (balanco do dia) - ver
// RelatorioDiarioNotificacaoService pro texto de cada um.
//
// Os horarios sao editaveis no painel (Configuracoes > Integracao ERP >
// Agendamentos), entao um @Cron fixo nao serve: roda a cada minuto e compara
// com o horario configurado, no fuso de Brasilia (o horario em si E' o
// requisito - 7h/18h de Brasilia pro vendedor, nao do container em UTC).
@Injectable()
export class RelatorioDiarioNotificacaoScheduler {
  constructor(
    @InjectQueue(RELATORIO_DIARIO_QUEUE) private readonly queue: Queue,
    private readonly configuracao: CredenciaisErpService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async verificarHorario(agora: Date = new Date()): Promise<void> {
    const manha = horarioOuPadrao(this.configuracao.get('RELATORIO_DIARIO_HORA_MANHA'), HORARIO_PADRAO_MANHA);
    const fimDia = horarioOuPadrao(this.configuracao.get('RELATORIO_DIARIO_HORA_FIM_DIA'), HORARIO_PADRAO_FIM_DIA);

    if (ehMomentoDoRelatorio(agora, manha)) {
      await this.queue.add(RELATORIO_DIARIO_JOB_NAME, { momento: 'MANHA' });
    }
    if (ehMomentoDoRelatorio(agora, fimDia)) {
      await this.queue.add(RELATORIO_DIARIO_JOB_NAME, { momento: 'FIM_DIA' });
    }
  }
}
