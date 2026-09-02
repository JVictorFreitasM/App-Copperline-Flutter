import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncLogStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SYNC_STRATEGIES } from './sync.constants';
import type { SyncStrategy, SyncWindow } from './sync-strategy.interface';

// Orquestrador generico (ver skill nestjs, "Arquitetura de Sincronizacao com
// ERP"): dado o nome de uma entidade, escolhe a strategy certa, executa e e
// o unico ponto que grava em sync_logs/sync_entities. Nunca muda quando uma
// nova entidade e adicionada - so a lista de strategies injetadas cresce.
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(SYNC_STRATEGIES) private readonly strategies: SyncStrategy[],
  ) {}

  async executar(nomeEntidade: string): Promise<void> {
    const strategy = this.encontrarStrategy(nomeEntidade);
    const syncEntity = await this.obterOuCriarSyncEntity(nomeEntidade);
    const ehCargaInicial = syncEntity.ultimaSincronizacao === null;

    const iniciadoEm = new Date();
    const janela: SyncWindow = {
      desde: this.obterDesde(nomeEntidade, syncEntity.ultimaSincronizacao),
      ate: iniciadoEm,
    };

    if (ehCargaInicial) {
      this.logger.log(
        `Primeira sincronizacao de '${nomeEntidade}' - carga inicial desde ${janela.desde.toISOString()}`,
      );
    }

    const log = await this.prisma.syncLog.create({
      data: { syncEntityId: syncEntity.id, iniciadoEm },
    });

    let processados = 0;
    let comErro = 0;
    let ultimoErro: Record<string, string> | null = null;

    let registrosBrutos: unknown[];
    let avisos: string[];
    try {
      const resultado = await strategy.fetch(janela);
      registrosBrutos = resultado.registros;
      avisos = resultado.avisos;

      if (avisos.length > 0) {
        this.logger.warn(
          `Sincronizacao de '${nomeEntidade}' com ${avisos.length} aviso(s): ${avisos.join(' | ')}`,
        );
      }
    } catch (error) {
      // Falha na busca inteira - nao avanca o cursor, a mesma janela e
      // retentada na proxima execucao.
      await this.prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: SyncLogStatus.ERRO,
          finalizadoEm: new Date(),
          registrosComErro: 1,
          erro: this.serializarErro(error),
        },
      });
      throw error;
    }

    for (const bruto of registrosBrutos) {
      try {
        const mapeado = strategy.map(bruto);
        await strategy.upsert(mapeado);
        processados++;
      } catch (error) {
        comErro++;
        ultimoErro = this.serializarErro(error);
        this.logger.error(
          `Falha ao sincronizar um registro de '${nomeEntidade}'`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    // O cursor avanca mesmo com erros pontuais de registro - fetch()
    // funcionou, entao reprocessar a mesma janela para sempre nao ajudaria
    // os registros que falharam (ja contabilizados em registrosComErro).
    await this.prisma.$transaction([
      this.prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: comErro > 0 ? SyncLogStatus.ERRO : SyncLogStatus.SUCESSO,
          finalizadoEm: new Date(),
          registrosProcessados: processados,
          registrosComErro: comErro,
          erro: ultimoErro ?? undefined,
          avisos: avisos.length > 0 ? avisos : undefined,
        },
      }),
      this.prisma.syncEntity.update({
        where: { id: syncEntity.id },
        data: { ultimaSincronizacao: iniciadoEm },
      }),
    ]);

    this.logger.log(
      `Sincronizacao de '${nomeEntidade}' concluida: ${processados} ok, ${comErro} com erro`,
    );
  }

  // Nunca usar new Date(0) como fallback pra primeira sincronizacao - ja
  // causou incidente real (janela de dezenas de anos, o WK Radar nunca
  // responde tudo isso: timeout/429 sustentado, sincronizacao nunca
  // completava, mesmo apos varias tentativas). Data de inicio da carga
  // inicial e decisao de negocio (ver skill wk-radar-client, secao
  // "Paginacao": "a primeira carga completa... iterar por janelas desde
  // uma data de inicio definida pelo negocio, nao tentar buscar tudo desde
  // sempre numa chamada so"), configuravel por entidade - falha alto e
  // claro se nao estiver configurada, em vez de adivinhar de novo.
  private obterDesde(
    nomeEntidade: string,
    ultimaSincronizacao: Date | null,
  ): Date {
    if (ultimaSincronizacao) {
      return ultimaSincronizacao;
    }

    // replace(/-/g, '_') - nome de entidade com hifen (ex: "nota-fiscal")
    // vira variavel de ambiente invalida sem isso ("WK_RADAR_NOTA-FISCAL_...",
    // que nem o .env nem a interpolacao ${...} do docker-compose aceitam
    // como identificador). Bug real encontrado na auditoria OS-BACKEND-42:
    // nota-fiscal falhava aqui em toda tentativa, ANTES de gravar syncLog -
    // por isso nunca aparecia nem sucesso nem erro em sync_logs.
    const chaveEnv = `WK_RADAR_${nomeEntidade.toUpperCase().replace(/-/g, '_')}_DATA_INICIO_CARGA`;
    const valor = this.configService.get<string>(chaveEnv);
    if (!valor) {
      throw new Error(
        `Primeira sincronizacao de '${nomeEntidade}' sem cursor e sem ${chaveEnv} configurada - defina a data de inicio da carga inicial (decisao de negocio) antes de rodar.`,
      );
    }

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) {
      throw new Error(
        `${chaveEnv} invalida: '${valor}' nao e uma data valida.`,
      );
    }
    return data;
  }

  private encontrarStrategy(nomeEntidade: string): SyncStrategy {
    const strategy = this.strategies.find(
      (item) => item.nomeEntidade === nomeEntidade,
    );
    if (!strategy) {
      throw new Error(
        `Nenhuma strategy de sincronizacao registrada para '${nomeEntidade}'`,
      );
    }
    return strategy;
  }

  private async obterOuCriarSyncEntity(nome: string) {
    return this.prisma.syncEntity.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  private serializarErro(error: unknown): Record<string, string> {
    if (error instanceof Error) {
      return error.stack
        ? { mensagem: error.message, stack: error.stack }
        : { mensagem: error.message };
    }
    return { mensagem: String(error) };
  }
}
