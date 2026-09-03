import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { LlmClientService } from '../llm-client/llm-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  calcularVariacaoAnoAnterior,
  gerarSerieMensal,
  type VendaBruta,
  type VendaMensal,
} from './domain/calcular-sazonalidade';

const MESES_JANELA = 13;
// Semanal (nao diario) - o padrao sazonal nao muda de um dia pro outro,
// mesmo criterio de custo/beneficio ja usado no cache de 24h de
// ClienteResumoLlmService, so' que aqui a janela pode ser bem maior.
const TTL_CACHE_SEGUNDOS = 7 * 24 * 60 * 60;

const SYSTEM_PROMPT = `Você é um analista de vendas B2B. Você recebe (via mensagem do usuário) a série mensal de vendas de um produto já calculada (13 meses) e a variação percentual do mês atual contra o mesmo mês do ano anterior, já calculadas por regra determinística.

REGRAS OBRIGATÓRIAS:
- Gere 2-3 frases de insight ACIONÁVEL a partir EXCLUSIVAMENTE dos números fornecidos (ex: sugerir reforçar estoque antes de um pico identificado nos dados, alertar sobre queda consistente).
- NUNCA invente número, mês ou tendência que não esteja nos dados fornecidos. Você só INTERPRETA o que já foi calculado, nunca calcula nada sozinho.
- Se a variação for null (sem base de comparação) ou os dados forem insuficientes pra um insight útil, diga isso claramente em vez de forçar uma conclusão.
- Responda APENAS com um objeto JSON no formato: {"insight": string}.`;

const InsightSchema = z.object({ insight: z.string() });

export interface SazonalidadeDto {
  produtoId: string;
  serieMensal: VendaMensal[];
  variacaoAnoAnteriorPercentual: number | null;
  insight: string | null;
}

// GET /dashboard/sazonalidade?produtoId= (OS-BACKEND-49) - calculo da serie
// mensal e da variacao (domain/calcular-sazonalidade.ts) e' 100%
// deterministico e auditavel independente da IA; o insight textual so'
// interpreta os numeros ja prontos, nunca decide o calculo.
@Injectable()
export class SazonalidadeService {
  private readonly logger = new Logger(SazonalidadeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmClientService: LlmClientService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async obter(produtoId: string): Promise<SazonalidadeDto> {
    const produto = await this.prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true },
    });
    if (!produto) {
      throw new NotFoundException(`Produto '${produtoId}' não encontrado`);
    }

    const hoje = new Date();
    const dataInicioJanela = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - (MESES_JANELA - 1), 1),
    );

    const itens = await this.prisma.pedidoItem.findMany({
      where: {
        produtoId,
        valorTotal: { not: null },
        pedido: { dataHoraUltimaAlteracao: { gte: dataInicioJanela } },
      },
      select: {
        valorTotal: true,
        pedido: { select: { dataHoraUltimaAlteracao: true } },
      },
    });

    const vendas: VendaBruta[] = itens
      .filter((item) => item.pedido.dataHoraUltimaAlteracao !== null)
      .map((item) => ({
        data: item.pedido.dataHoraUltimaAlteracao as Date,
        valor: Number(item.valorTotal),
      }));

    const serieMensal = gerarSerieMensal(vendas, hoje, MESES_JANELA);
    const variacaoAnoAnteriorPercentual = calcularVariacaoAnoAnterior(serieMensal);

    return {
      produtoId,
      serieMensal,
      variacaoAnoAnteriorPercentual,
      insight: await this.obterInsight(produtoId, serieMensal, variacaoAnoAnteriorPercentual),
    };
  }

  private async obterInsight(
    produtoId: string,
    serieMensal: VendaMensal[],
    variacaoAnoAnteriorPercentual: number | null,
  ): Promise<string | null> {
    const chaveCache = `cache:sazonalidade-insight:${produtoId}`;
    const cacheado = await this.redis.get(chaveCache);
    if (cacheado) {
      return cacheado;
    }

    try {
      const resultado = await this.llmClientService.gerarJson(
        SYSTEM_PROMPT,
        JSON.stringify({ serieMensal, variacaoAnoAnteriorPercentual }),
        InsightSchema,
      );
      await this.redis.set(chaveCache, resultado.insight, 'EX', TTL_CACHE_SEGUNDOS);
      return resultado.insight;
    } catch (error) {
      // Mesmo criterio de OportunidadeClienteService - falha na geracao do
      // TEXTO nao derruba o calculo deterministico, que ja e' util sozinho.
      this.logger.warn(
        `Falha ao gerar insight de sazonalidade pro produto ${produtoId}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}
