import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../common/pagination';
import { paginar } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SYNC_STRATEGIES } from './sync.constants';
import type { SyncStrategy } from './sync-strategy.interface';

export interface SyncLogResumoDto {
  id: string;
  status: string;
  iniciadoEm: string;
  finalizadoEm: string | null;
  // null enquanto o log ainda esta EM_ANDAMENTO (sem finalizadoEm).
  duracaoMs: number | null;
  registrosProcessados: number;
  registrosComErro: number;
  // Sempre lista (nunca o Json cru do banco) - "de forma legivel" (ver
  // criterio de aceite da OS).
  avisos: string[];
  erro: Record<string, string> | null;
}

export interface RegistroIncompletoDto {
  id: string;
  idExternoErp: string;
  // sincronizadoEm da linha-stub - momento em que ela foi criada, ainda
  // nao atualizado pela sync "de verdade" da propria entidade (ver
  // comentario de `incompleto` em cada model do schema.prisma).
  incompletoDesde: string;
  idadeEmHoras: number;
}

export interface RegistrosIncompletosDto {
  cliente: RegistroIncompletoDto[];
  produto: RegistroIncompletoDto[];
  pedido: RegistroIncompletoDto[];
}

// So leitura/diagnostico (OS-BACKEND-16) - expoe via API o que hoje so
// dava pra ver em log de servidor ou consulta direta no banco. Nenhuma
// acao corretiva aqui (fora de escopo, ver OS).
@Injectable()
export class SyncObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SYNC_STRATEGIES) private readonly strategies: SyncStrategy[],
  ) {}

  async listarLogs(
    nomeEntidade: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<SyncLogResumoDto>> {
    this.encontrarStrategyOuFalhar(nomeEntidade);

    const syncEntity = await this.prisma.syncEntity.findUnique({
      where: { nome: nomeEntidade },
    });
    if (!syncEntity) {
      // Entidade conhecida (existe strategy), mas nunca sincronizou ainda
      // - sem sync_entities, nao ha sync_logs pra buscar.
      return paginar([], 0, page, limit);
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.syncLog.findMany({
        where: { syncEntityId: syncEntity.id },
        orderBy: { iniciadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.syncLog.count({ where: { syncEntityId: syncEntity.id } }),
    ]);

    return paginar(logs.map(paraSyncLogResumoDto), total, page, limit);
  }

  async listarRegistrosIncompletos(): Promise<RegistrosIncompletosDto> {
    const agora = new Date();
    const [clientes, produtos, pedidos] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { incompleto: true },
        select: { id: true, idExternoErp: true, sincronizadoEm: true },
      }),
      this.prisma.produto.findMany({
        where: { incompleto: true },
        select: { id: true, idExternoErp: true, sincronizadoEm: true },
      }),
      this.prisma.pedido.findMany({
        where: { incompleto: true },
        select: { id: true, idExternoErp: true, sincronizadoEm: true },
      }),
    ]);

    return {
      cliente: clientes.map((c) => paraRegistroIncompletoDto(c, agora)),
      produto: produtos.map((p) => paraRegistroIncompletoDto(p, agora)),
      // idExternoErp e' sempre string aqui na pratica (nunca null): um
      // stub (incompleto:true) so existe porque foi criado a partir de um
      // idExternoErp real referenciado por outra entidade (ver
      // resolverOuCriarPedidoStub em nota-fiscal.sync.ts) - null so
      // acontece pra pedido criado localmente (OS-BACKEND-25), que nunca
      // e' incompleto:true. Cast documentado, nao um bug latente.
      pedido: pedidos.map((p) =>
        paraRegistroIncompletoDto(
          { ...p, idExternoErp: p.idExternoErp as string },
          agora,
        ),
      ),
    };
  }

  private encontrarStrategyOuFalhar(nomeEntidade: string): void {
    const existe = this.strategies.some((s) => s.nomeEntidade === nomeEntidade);
    if (!existe) {
      throw new NotFoundException(
        `'${nomeEntidade}' nao e uma entidade sincronizada conhecida`,
      );
    }
  }
}

function paraSyncLogResumoDto(log: {
  id: string;
  status: string;
  iniciadoEm: Date;
  finalizadoEm: Date | null;
  registrosProcessados: number;
  registrosComErro: number;
  avisos: unknown;
  erro: unknown;
}): SyncLogResumoDto {
  return {
    id: log.id,
    status: log.status,
    iniciadoEm: log.iniciadoEm.toISOString(),
    finalizadoEm: log.finalizadoEm?.toISOString() ?? null,
    duracaoMs: log.finalizadoEm
      ? log.finalizadoEm.getTime() - log.iniciadoEm.getTime()
      : null,
    registrosProcessados: log.registrosProcessados,
    registrosComErro: log.registrosComErro,
    avisos: Array.isArray(log.avisos) ? (log.avisos as string[]) : [],
    erro: (log.erro as Record<string, string> | null) ?? null,
  };
}

function paraRegistroIncompletoDto(
  registro: { id: string; idExternoErp: string; sincronizadoEm: Date },
  agora: Date,
): RegistroIncompletoDto {
  const idadeMs = agora.getTime() - registro.sincronizadoEm.getTime();
  return {
    id: registro.id,
    idExternoErp: registro.idExternoErp,
    incompletoDesde: registro.sincronizadoEm.toISOString(),
    idadeEmHoras: Math.round((idadeMs / (60 * 60 * 1000)) * 10) / 10,
  };
}
