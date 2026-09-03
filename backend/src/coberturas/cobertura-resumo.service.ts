import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { LlmClientService } from '../llm-client/llm-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

const TTL_CACHE_SEGUNDOS = 24 * 60 * 60;
const QUANTIDADE_PEDIDOS_RECENTES = 5;

const SYSTEM_PROMPT = `Você é um assistente de vendas B2B. Você recebe (via mensagem do usuário) dados reais de um cliente (fornecidos em JSON) e deve gerar um resumo curto (2-3 linhas) para um vendedor que está assumindo temporariamente essa carteira e precisa se situar rápido.

REGRAS OBRIGATÓRIAS:
- Use ESTRITAMENTE os dados fornecidos. NUNCA invente produto, valor ou fato que não esteja no JSON.
- Se os dados forem insuficientes (ex: cliente sem pedido algum), diga isso claramente em vez de forçar um resumo.
- Responda APENAS com um objeto JSON no formato: {"resumo": string}.`;

const ResumoSchema = z.object({ resumo: z.string() });

export interface ClienteResumoHandoffDto {
  clienteId: string;
  clienteNome: string | null;
  resumo: string | null;
}

export interface CoberturaResumoDto {
  coberturaId: string;
  clientes: ClienteResumoHandoffDto[];
}

// GET /coberturas/:id/resumo (OS-BACKEND-48) - resumo de handoff por
// cliente da carteira COBERTA (nunca da propria carteira do substituto),
// gerado em lote no inicio da cobertura. Mesmo padrao de cache/IA de
// ClienteResumoLlmService, aplicado por cliente.
@Injectable()
export class CoberturaResumoService {
  private readonly logger = new Logger(CoberturaResumoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmClientService: LlmClientService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async obterResumo(
    coberturaId: string,
    idpUser: IdpUser,
    usuarioId: string,
  ): Promise<CoberturaResumoDto> {
    const cobertura = await this.prisma.coberturaTemporaria.findUnique({
      where: { id: coberturaId },
    });
    if (!cobertura) {
      throw new NotFoundException(`Cobertura '${coberturaId}' não encontrada`);
    }

    if (idpUser.role !== 'admin') {
      const vendedorAtual = await this.prisma.vendedor.findFirst({
        where: { usuarioId },
        select: { id: true },
      });
      // So' o proprio substituto (ou admin) ve o resumo de handoff - evita
      // IDOR (qualquer vendedor consultando resumo de carteira alheia).
      if (!vendedorAtual || vendedorAtual.id !== cobertura.vendedorSubstitutoId) {
        throw new ForbiddenException(
          'Sem permissão para consultar o resumo desta cobertura',
        );
      }
    }

    const clientes = await this.prisma.cliente.findMany({
      where: { vendedores: { some: { vendedorId: cobertura.vendedorOriginalId } } },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
    });

    const resultado: ClienteResumoHandoffDto[] = [];
    for (const cliente of clientes) {
      resultado.push({
        clienteId: cliente.id,
        clienteNome: cliente.razaoSocial ?? cliente.nomeFantasia,
        resumo: await this.obterResumoCliente(cliente.id),
      });
    }

    return { coberturaId, clientes: resultado };
  }

  private async obterResumoCliente(clienteId: string): Promise<string | null> {
    const chaveCache = `cache:cobertura-resumo-cliente:${clienteId}`;
    const cacheado = await this.redis.get(chaveCache);
    if (cacheado) {
      return cacheado;
    }

    const [pedidos, ticketMedio] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { clienteId },
        orderBy: { dataHoraUltimaAlteracao: 'desc' },
        take: QUANTIDADE_PEDIDOS_RECENTES,
        select: { numero: true, situacao: true, valorTotal: true, dataHoraUltimaAlteracao: true },
      }),
      this.prisma.pedido.aggregate({
        where: { clienteId },
        _avg: { valorTotal: true },
      }),
    ]);

    const dados = {
      pedidosRecentes: pedidos.map((p) => ({
        numero: p.numero,
        situacao: p.situacao,
        valorTotal: p.valorTotal?.toString() ?? null,
        data: p.dataHoraUltimaAlteracao?.toISOString() ?? null,
      })),
      ticketMedio: (ticketMedio._avg.valorTotal ?? 0).toString(),
    };

    try {
      const resultado = await this.llmClientService.gerarJson(
        SYSTEM_PROMPT,
        JSON.stringify(dados),
        ResumoSchema,
      );
      await this.redis.set(chaveCache, resultado.resumo, 'EX', TTL_CACHE_SEGUNDOS);
      return resultado.resumo;
    } catch (error) {
      this.logger.warn(
        `Falha ao gerar resumo de handoff pro cliente ${clienteId}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}
