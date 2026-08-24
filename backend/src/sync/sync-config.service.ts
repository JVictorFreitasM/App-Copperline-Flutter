import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { TipoCadenciaSync } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { construirRepeatOptions } from './construir-repeat-options';
import { SYNC_JOB_NAME, SYNC_QUEUE, SYNC_STRATEGIES } from './sync.constants';
import type { SyncScheduling, SyncStrategy } from './sync-strategy.interface';

// Entidades cujo fetch() ignora o cursor incremental por limitacao
// estrutural do ERP (nao regra de negocio nossa) - nota-fiscal so tem
// filtro por data de EMISSAO, nao "alterado desde" (ver
// NotaFiscalSyncStrategy); saldo_estoque/Estoque.svc nao suporta filtro
// incremental neste ambiente (confirmado empiricamente na OS de
// sincronizacao de saldo). Setar INCREMENTAL puro pra essas entidades
// prometeria um comportamento (so o que mudou) que o fetch() delas nao
// entrega - por isso a API rejeita em vez de aceitar silenciosamente.
const ENTIDADES_SEM_CURSOR_INCREMENTAL = new Set(['nota-fiscal', 'saldo_estoque']);

// Cadencia padrao de cada entidade SEM ConfiguracaoSync salva - espelha os
// @Cron fixos de sync.scheduler.ts (EVERY_30_MINUTES, '0 0 * * *',
// '15 3 * * *'). Fonte duplicada de proposito: sync.scheduler.ts continua
// sendo a fonte de verdade de EXECUCAO do fallback (os @Cron em si); isto
// aqui e' so pra exibir um valor coerente em GET /admin/sync/configuracoes
// antes do admin salvar uma config propria.
const INTERVALO_PADRAO_INCREMENTAL_MINUTOS = 30;
const HORARIO_PADRAO_INCREMENTAL_NOTURNO = '00:00';
const HORARIO_PADRAO_JANELA_FIXA_DIARIA = '03:15';
const INTERVALO_PADRAO_CONFIGURAVEL_MINUTOS = 30;

export interface ConfiguracaoSyncDto {
  nomeEntidade: string;
  tipoCadencia: SyncScheduling;
  intervaloMinutos: number | null;
  horarioFixo: string | null;
  diasSemana: number[];
  origem: 'CONFIGURADA' | 'PADRAO';
  ultimaSincronizacaoEm: string | null;
}

export interface AtualizarConfiguracaoSyncInput {
  tipoCadencia: TipoCadenciaSync;
  intervaloMinutos?: number;
  horarioFixo?: string;
  diasSemana?: number[];
}

// Generaliza o padrao que a OS anterior criou so pra saldo_estoque
// (ConfiguracaoSyncEstoqueService, removido - ver estoque.module.ts) pra
// qualquer entidade em SYNC_STRATEGIES. Unico ponto que le/grava
// ConfiguracaoSync e chama upsertJobScheduler - SyncScheduler (os 3 @Cron
// fixos) so cobre entidades SEM linha aqui (ver sync.scheduler.ts).
@Injectable()
export class SyncConfigService implements OnModuleInit {
  private readonly logger = new Logger(SyncConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue,
    @Inject(SYNC_STRATEGIES) private readonly strategies: SyncStrategy[],
  ) {}

  async onModuleInit(): Promise<void> {
    const configuracoes = await this.prisma.configuracaoSync.findMany();
    for (const config of configuracoes) {
      await this.registrarJobScheduler(config.nomeEntidade, config);
    }
  }

  async listar(): Promise<ConfiguracaoSyncDto[]> {
    const [configuracoes, syncEntities] = await Promise.all([
      this.prisma.configuracaoSync.findMany(),
      this.prisma.syncEntity.findMany(),
    ]);
    const configPorEntidade = new Map(configuracoes.map((c) => [c.nomeEntidade, c]));
    const ultimaSyncPorEntidade = new Map(
      syncEntities.map((e) => [e.nome, e.ultimaSincronizacao]),
    );

    return this.strategies.map((strategy) => {
      const salva = configPorEntidade.get(strategy.nomeEntidade);
      const ultimaSincronizacao = ultimaSyncPorEntidade.get(strategy.nomeEntidade) ?? null;

      if (salva) {
        return {
          nomeEntidade: strategy.nomeEntidade,
          tipoCadencia: salva.tipoCadencia,
          intervaloMinutos: salva.intervaloMinutos,
          horarioFixo: salva.horarioFixo,
          diasSemana: salva.diasSemana,
          origem: 'CONFIGURADA',
          ultimaSincronizacaoEm: ultimaSincronizacao?.toISOString() ?? null,
        };
      }

      return {
        ...this.padraoParaEntidade(strategy),
        ultimaSincronizacaoEm: ultimaSincronizacao?.toISOString() ?? null,
      };
    });
  }

  async atualizar(
    nomeEntidade: string,
    input: AtualizarConfiguracaoSyncInput,
  ): Promise<ConfiguracaoSyncDto> {
    this.encontrarStrategyOuFalhar(nomeEntidade);

    if (
      ENTIDADES_SEM_CURSOR_INCREMENTAL.has(nomeEntidade) &&
      input.tipoCadencia === 'INCREMENTAL'
    ) {
      throw new BadRequestException(
        `'${nomeEntidade}' nao suporta tipoCadencia 'INCREMENTAL' - o fetch() dessa entidade nao tem como filtrar so o que mudou desde a ultima sincronizacao (limitacao do ERP, nao configuravel). Use 'CONFIGURAVEL' (intervalo fixo, full refresh) ou 'JANELA_FIXA_DIARIA'/'INCREMENTAL_NOTURNO' (horario fixo).`,
      );
    }

    const dados = {
      tipoCadencia: input.tipoCadencia,
      intervaloMinutos: input.intervaloMinutos ?? null,
      horarioFixo: input.horarioFixo ?? null,
      diasSemana: input.diasSemana ?? [],
    };

    const salva = await this.prisma.configuracaoSync.upsert({
      where: { nomeEntidade },
      create: { nomeEntidade, ...dados },
      update: dados,
    });

    await this.registrarJobScheduler(nomeEntidade, salva);
    this.logger.log(
      `Cadencia de sincronizacao de '${nomeEntidade}' atualizada para ${input.tipoCadencia}`,
    );

    const syncEntity = await this.prisma.syncEntity.findUnique({
      where: { nome: nomeEntidade },
    });
    return {
      nomeEntidade,
      tipoCadencia: salva.tipoCadencia,
      intervaloMinutos: salva.intervaloMinutos,
      horarioFixo: salva.horarioFixo,
      diasSemana: salva.diasSemana,
      origem: 'CONFIGURADA',
      ultimaSincronizacaoEm: syncEntity?.ultimaSincronizacao?.toISOString() ?? null,
    };
  }

  async executarAgora(nomeEntidade: string): Promise<void> {
    this.encontrarStrategyOuFalhar(nomeEntidade);
    await this.queue.add(SYNC_JOB_NAME, { nomeEntidade });
    this.logger.log(`Sincronizacao de '${nomeEntidade}' enfileirada manualmente`);
  }

  private async registrarJobScheduler(
    nomeEntidade: string,
    config: {
      tipoCadencia: TipoCadenciaSync;
      intervaloMinutos: number | null;
      horarioFixo: string | null;
      diasSemana: number[];
    },
  ): Promise<void> {
    const repeatOptions = construirRepeatOptions(config);
    await this.queue.upsertJobScheduler(`${nomeEntidade}-repeat`, repeatOptions, {
      name: SYNC_JOB_NAME,
      data: { nomeEntidade },
    });
  }

  private encontrarStrategyOuFalhar(nomeEntidade: string): SyncStrategy {
    const strategy = this.strategies.find((s) => s.nomeEntidade === nomeEntidade);
    if (!strategy) {
      throw new NotFoundException(
        `'${nomeEntidade}' nao e uma entidade sincronizada conhecida`,
      );
    }
    return strategy;
  }

  private padraoParaEntidade(
    strategy: SyncStrategy,
  ): Omit<ConfiguracaoSyncDto, 'ultimaSincronizacaoEm'> {
    const tipoCadencia = strategy.agendamento ?? 'INCREMENTAL';
    const base = {
      nomeEntidade: strategy.nomeEntidade,
      tipoCadencia,
      origem: 'PADRAO' as const,
    };

    switch (tipoCadencia) {
      case 'INCREMENTAL':
        return {
          ...base,
          intervaloMinutos: INTERVALO_PADRAO_INCREMENTAL_MINUTOS,
          horarioFixo: null,
          diasSemana: [],
        };
      case 'CONFIGURAVEL':
        return {
          ...base,
          intervaloMinutos: INTERVALO_PADRAO_CONFIGURAVEL_MINUTOS,
          horarioFixo: null,
          diasSemana: [],
        };
      case 'INCREMENTAL_NOTURNO':
        return {
          ...base,
          intervaloMinutos: null,
          horarioFixo: HORARIO_PADRAO_INCREMENTAL_NOTURNO,
          diasSemana: [],
        };
      case 'JANELA_FIXA_DIARIA':
        return {
          ...base,
          intervaloMinutos: null,
          horarioFixo: HORARIO_PADRAO_JANELA_FIXA_DIARIA,
          diasSemana: [],
        };
    }
  }

}
