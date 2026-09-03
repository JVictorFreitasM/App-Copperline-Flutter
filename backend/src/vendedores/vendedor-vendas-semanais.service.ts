import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { VendedorVendasService } from './vendedor-vendas.service';

export interface SemanaVendaDto {
  semanaInicio: string;
  valorVendido: number;
}

const SEMANAS_PADRAO = 8;
// Sparkline nao precisa de dado ao segundo (OS-MOBILE-41 - "evitar
// recalculo pesado a cada abertura da home") - 6h de cache e' suficiente
// pra uma tendencia de varias semanas, mesma logica de TTL curto pra dado
// que muda rápido ja usada em contexto-aprovacao-desconto (1h).
const TTL_CACHE_SEGUNDOS = 6 * 60 * 60;

// OS-MOBILE-41 - evolucao semanal de vendas do PROPRIO vendedor (sparkline
// na home do app). Reaproveita VendedorVendasService.valorVendidoPorVendedor
// (mesma atribuicao por vinculo Cliente-Vendedor do ranking/metas) uma vez
// por semana da janela, em vez de duplicar a logica de atribuicao aqui.
@Injectable()
export class VendedorVendasSemanaisService {
  constructor(
    private readonly vendedorVendasService: VendedorVendasService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async obter(
    vendedorId: string,
    semanas: number = SEMANAS_PADRAO,
  ): Promise<SemanaVendaDto[]> {
    const chaveCache = `cache:vendas-semanais:${vendedorId}:${semanas}`;
    const cacheado = await this.redis.get(chaveCache);
    if (cacheado) {
      return JSON.parse(cacheado) as SemanaVendaDto[];
    }

    const segundaAtual = inicioDaSemana(new Date());
    const resultado: SemanaVendaDto[] = [];
    for (let i = semanas - 1; i >= 0; i--) {
      const inicio = new Date(segundaAtual);
      inicio.setUTCDate(inicio.getUTCDate() - i * 7);
      const fim = new Date(inicio);
      fim.setUTCDate(fim.getUTCDate() + 7);

      const valoresPorVendedor =
        await this.vendedorVendasService.valorVendidoPorVendedor({
          gte: inicio,
          lte: fim,
        });
      resultado.push({
        semanaInicio: inicio.toISOString().substring(0, 10),
        valorVendido: valoresPorVendedor.get(vendedorId) ?? 0,
      });
    }

    await this.redis.set(
      chaveCache,
      JSON.stringify(resultado),
      'EX',
      TTL_CACHE_SEGUNDOS,
    );
    return resultado;
  }
}

function inicioDaSemana(data: Date): Date {
  const copia = new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()),
  );
  const diaSemana = copia.getUTCDay();
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  copia.setUTCDate(copia.getUTCDate() + diff);
  return copia;
}
