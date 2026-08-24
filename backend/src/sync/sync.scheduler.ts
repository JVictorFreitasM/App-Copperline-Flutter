import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SYNC_JOB_NAME, SYNC_QUEUE, SYNC_STRATEGIES } from './sync.constants';
import type { SyncStrategy } from './sync-strategy.interface';

// So enfileira jobs via cron - nenhuma logica de negocio aqui (ver skill
// nestjs). Ramifica por strategy.agendamento (generico), nunca por nome de
// entidade - adicionar uma nova entidade sincronizada (qualquer cadencia)
// nao exige tocar neste arquivo, so declarar `agendamento` na propria
// strategy.
//
// FALLBACK (OS-BACKEND-15): entidades com uma linha em ConfiguracaoSync
// tem seu proprio BullMQ Job Scheduler (ver SyncConfigService), registrado
// com a cadencia que o admin configurou - os @Cron fixos aqui so cobrem
// quem AINDA nao tem config salva. `enfileirar()` sempre consulta o banco
// e exclui essas entidades, senao ficariam enfileiradas duas vezes (aqui
// E pelo Job Scheduler proprio).
@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue,
    @Inject(SYNC_STRATEGIES) private readonly strategies: SyncStrategy[],
    private readonly prisma: PrismaService,
  ) {}

  // Cadencia padrao (INCREMENTAL) - baixo volume (cliente): cobre
  // [ultimaSincronizacao, agora] a cada execucao.
  @Cron(CronExpression.EVERY_30_MINUTES)
  async agendarIncrementais(): Promise<void> {
    await this.enfileirar(
      this.strategies.filter(
        (s) => (s.agendamento ?? 'INCREMENTAL') === 'INCREMENTAL',
      ),
    );
  }

  // Cadencia noturna (INCREMENTAL_NOTURNO) - produto/pedido: mesmo cursor
  // incremental do modo acima, so que uma vez por dia as 00:00 em vez de a
  // cada 30 min. Horario escolhido pra rodar fora do expediente, quando
  // outros sistemas presumivelmente disputam menos o limite de requisicoes
  // compartilhado do WK Radar. As entidades desse grupo compartilham a
  // mesma fila com concurrency:1 (ver SyncProcessor) - rodam uma atras da
  // outra, nao em paralelo, o que ja distribui a carga ao longo da
  // madrugada sem precisar de um cron por entidade.
  @Cron('0 0 * * *')
  async agendarIncrementaisNoturnos(): Promise<void> {
    await this.enfileirar(
      this.strategies.filter((s) => s.agendamento === 'INCREMENTAL_NOTURNO'),
    );
  }

  // Cadencia diaria (JANELA_FIXA_DIARIA) - ex: nota-fiscal (OS 09), sem
  // filtro de "alterado desde" no WK Radar, reprocessa uma janela
  // retroativa fixa por execucao. Horario 03:15 (madrugada, fora do
  // horario comercial) escolhido pra nao cair exatamente no mesmo instante
  // dos ticks incrementais de 30 em 30 min (que disparam em :00 e :30) -
  // mesmo que colidissem, a fila e processada com concurrency:1 (ver
  // SyncProcessor), entao nunca rodam em paralelo, so um atras do outro;
  // o horario deslocado e so pra manter os logs de cada cadencia mais
  // faceis de distinguir por timestamp.
  @Cron('15 3 * * *')
  async agendarJanelaFixaDiaria(): Promise<void> {
    await this.enfileirar(
      this.strategies.filter((s) => s.agendamento === 'JANELA_FIXA_DIARIA'),
    );
  }

  private async enfileirar(strategies: SyncStrategy[]): Promise<void> {
    const semConfigSalva = await this.filtrarSemConfigSalva(strategies);

    for (const strategy of semConfigSalva) {
      await this.queue.add(SYNC_JOB_NAME, {
        nomeEntidade: strategy.nomeEntidade,
      });
    }
    if (semConfigSalva.length > 0) {
      this.logger.log(
        `Enfileirada(s) ${semConfigSalva.length} entidade(s) para sincronizacao`,
      );
    }
  }

  private async filtrarSemConfigSalva(
    strategies: SyncStrategy[],
  ): Promise<SyncStrategy[]> {
    if (strategies.length === 0) {
      return strategies;
    }
    const configuradas = await this.prisma.configuracaoSync.findMany({
      where: { nomeEntidade: { in: strategies.map((s) => s.nomeEntidade) } },
      select: { nomeEntidade: true },
    });
    const nomesConfigurados = new Set(configuradas.map((c) => c.nomeEntidade));
    return strategies.filter((s) => !nomesConfigurados.has(s.nomeEntidade));
  }
}
