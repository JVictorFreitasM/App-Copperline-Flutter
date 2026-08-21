import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SYNC_JOB_NAME, SYNC_QUEUE } from '../sync/sync.constants';
import type { ConfiguracaoSyncEstoqueDto } from './dto/configuracao-sync-estoque.dto';

const NOME_ENTIDADE_SALDO_ESTOQUE = 'saldo_estoque';
const JOB_SCHEDULER_ID = 'saldo-estoque-repeat';
const INTERVALO_PADRAO_MINUTOS = 30;

// Le/grava o intervalo (minutos) da sincronizacao de saldo de estoque e
// mantem o BullMQ job scheduler (repeatable) sincronizado com o valor
// salvo - unico ponto que chama upsertJobScheduler pra essa entidade,
// tanto no boot da aplicacao quanto quando o admin muda o valor via PATCH
// (ver acceptance criteria: "a alteracao passa a valer sem necessidade de
// deploy").
@Injectable()
export class ConfiguracaoSyncEstoqueService implements OnModuleInit {
  private readonly logger = new Logger(ConfiguracaoSyncEstoqueService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = await this.obterOuCriarConfiguracao();
    await this.registrarJobRepetido(config.intervaloSincronizacaoMinutos);

    // upsertJobScheduler agenda a PROXIMA execucao dali a `intervalo`
    // minutos, nao dispara uma imediata - sem isso, a tabela local ficaria
    // vazia (app comercial mostrando "sem saldo" pra tudo) ate o primeiro
    // intervalo completar. Um job avulso (sem jobId fixo, nao conflita com
    // o scheduler) cobre a carga inicial/todo boot.
    await this.queue.add(SYNC_JOB_NAME, {
      nomeEntidade: NOME_ENTIDADE_SALDO_ESTOQUE,
    });
  }

  async obter(): Promise<ConfiguracaoSyncEstoqueDto> {
    const [config, syncEntity] = await Promise.all([
      this.obterOuCriarConfiguracao(),
      this.prisma.syncEntity.findUnique({
        where: { nome: NOME_ENTIDADE_SALDO_ESTOQUE },
      }),
    ]);

    return {
      intervaloSincronizacaoMinutos: config.intervaloSincronizacaoMinutos,
      ultimaSincronizacaoEm:
        syncEntity?.ultimaSincronizacao?.toISOString() ?? null,
    };
  }

  async atualizar(minutos: number): Promise<ConfiguracaoSyncEstoqueDto> {
    const existente = await this.obterOuCriarConfiguracao();
    await this.prisma.configuracaoEstoque.update({
      where: { id: existente.id },
      data: { intervaloSincronizacaoMinutos: minutos },
    });
    await this.registrarJobRepetido(minutos);
    this.logger.log(
      `Intervalo de sincronizacao de saldo de estoque atualizado para ${minutos} minuto(s)`,
    );
    return this.obter();
  }

  private async registrarJobRepetido(minutos: number): Promise<void> {
    await this.queue.upsertJobScheduler(
      JOB_SCHEDULER_ID,
      { every: minutos * 60_000 },
      { name: SYNC_JOB_NAME, data: { nomeEntidade: NOME_ENTIDADE_SALDO_ESTOQUE } },
    );
  }

  private async obterOuCriarConfiguracao() {
    const existente = await this.prisma.configuracaoEstoque.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.configuracaoEstoque.create({
      data: { intervaloSincronizacaoMinutos: INTERVALO_PADRAO_MINUTOS },
    });
  }
}
