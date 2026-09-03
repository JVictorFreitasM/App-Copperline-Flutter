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

const TTL_CACHE_SEGUNDOS = 60 * 60;

const SYSTEM_PROMPT = `Você é um assistente que ajuda um supervisor/gerente a decidir uma solicitação de desconto acima do limite normal. Você recebe (via mensagem do usuário) números já calculados por consulta direta ao banco (nunca por você): histórico de descontos do vendedor solicitante, histórico do cliente (quando disponível) e a média da equipe.

REGRAS OBRIGATÓRIAS:
- Organize esses números em um texto curto (2-4 linhas) que dê contexto rápido pro supervisor decidir.
- Use ESTRITAMENTE os dados fornecidos. NUNCA invente número, e nunca diga se o desconto deveria ser aprovado ou rejeitado - a decisão continua 100% humana.
- Se algum dado vier como null/ausente (ex: sem pedido vinculado, sem histórico do cliente), diga isso claramente em vez de omitir ou inventar.
- Responda APENAS com um objeto JSON no formato: {"contexto": string}.`;

const ContextoSchema = z.object({ contexto: z.string() });

export interface ContextoAprovacaoDescontoDto {
  solicitacaoId: string;
  historicoVendedor: { quantidade: number; percentualMedio: number | null };
  historicoCliente: { quantidade: number; percentualMedio: number | null } | null;
  mediaEquipe: number | null;
  contexto: string | null;
}

// GET /solicitacoes-desconto/:id/contexto (OS-BACKEND-50) - todos os
// numeros vem de consulta direta (nao-IA); a LLM so' organiza em texto.
// Card informativo na tela de aprovacao (OS-WEB-21/OS-MOBILE-26), nunca
// decisao automatica - a decisao de aprovar/rejeitar continua 100% humana,
// esse endpoint nunca e' chamado por POST /aprovar ou /rejeitar.
@Injectable()
export class ContextoAprovacaoDescontoService {
  private readonly logger = new Logger(ContextoAprovacaoDescontoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmClientService: LlmClientService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async obterContexto(
    solicitacaoId: string,
    idpUser: IdpUser,
    usuarioId: string,
  ): Promise<ContextoAprovacaoDescontoDto> {
    const solicitacao = await this.prisma.solicitacaoDesconto.findUnique({
      where: { id: solicitacaoId },
      include: { pedido: { select: { clienteId: true } } },
    });
    if (!solicitacao) {
      throw new NotFoundException(
        `Solicitação de desconto '${solicitacaoId}' não encontrada`,
      );
    }

    if (idpUser.role !== 'admin') {
      const vendedorAtual = await this.prisma.vendedor.findFirst({
        where: { usuarioId },
        select: { id: true },
      });
      // So' o aprovador esperado (ou admin) pode ver o contexto - mesmo
      // criterio de quem PODE decidir a solicitacao (ver
      // SolicitacoesDescontoService.decidir), evita IDOR (qualquer
      // vendedor consultando contexto de solicitacao alheia).
      if (!vendedorAtual || vendedorAtual.id !== solicitacao.aprovadorEsperadoId) {
        throw new ForbiddenException(
          'Sem permissão para consultar o contexto desta solicitação',
        );
      }
    }

    const [historicoVendedor, historicoCliente, mediaEquipe] = await Promise.all([
      this.calcularHistorico({ vendedorSolicitanteId: solicitacao.vendedorSolicitanteId }),
      solicitacao.pedido?.clienteId
        ? this.calcularHistorico({ pedido: { clienteId: solicitacao.pedido.clienteId } })
        : Promise.resolve(null),
      this.calcularMediaEquipe(solicitacao.vendedorSolicitanteId),
    ]);

    return {
      solicitacaoId,
      historicoVendedor,
      historicoCliente,
      mediaEquipe,
      contexto: await this.gerarContexto(solicitacaoId, {
        percentualSolicitadoNestePedido: solicitacao.percentualSolicitado.toNumber(),
        historicoVendedor,
        historicoCliente,
        mediaEquipe,
      }),
    };
  }

  private async calcularHistorico(
    where: Record<string, unknown>,
  ): Promise<{ quantidade: number; percentualMedio: number | null }> {
    const agregado = await this.prisma.solicitacaoDesconto.aggregate({
      where,
      _count: true,
      _avg: { percentualSolicitado: true },
    });
    return {
      quantidade: agregado._count,
      percentualMedio: agregado._avg.percentualSolicitado?.toNumber() ?? null,
    };
  }

  // Media da EQUIPE (colegas com o mesmo supervisor, mesmo criterio ja
  // usado em RankingEquipeService pro vendedor comum) - nao inclui o
  // proprio vendedor solicitante, pra a comparacao fazer sentido ("ele vs
  // os outros"), nao ele mesmo diluido na propria media.
  private async calcularMediaEquipe(vendedorSolicitanteId: string): Promise<number | null> {
    const vendedor = await this.prisma.vendedor.findUnique({
      where: { id: vendedorSolicitanteId },
      select: { supervisorId: true },
    });
    if (!vendedor?.supervisorId) {
      return null;
    }

    const colegas = await this.prisma.vendedor.findMany({
      where: { supervisorId: vendedor.supervisorId, id: { not: vendedorSolicitanteId } },
      select: { id: true },
    });
    if (colegas.length === 0) {
      return null;
    }

    const agregado = await this.prisma.solicitacaoDesconto.aggregate({
      where: { vendedorSolicitanteId: { in: colegas.map((c) => c.id) } },
      _avg: { percentualSolicitado: true },
    });
    return agregado._avg.percentualSolicitado?.toNumber() ?? null;
  }

  private async gerarContexto(
    solicitacaoId: string,
    dados: Record<string, unknown>,
  ): Promise<string | null> {
    const chaveCache = `cache:contexto-aprovacao-desconto:${solicitacaoId}`;
    const cacheado = await this.redis.get(chaveCache);
    if (cacheado) {
      return cacheado;
    }

    try {
      const resultado = await this.llmClientService.gerarJson(
        SYSTEM_PROMPT,
        JSON.stringify(dados),
        ContextoSchema,
      );
      await this.redis.set(chaveCache, resultado.contexto, 'EX', TTL_CACHE_SEGUNDOS);
      return resultado.contexto;
    } catch (error) {
      this.logger.warn(
        `Falha ao gerar contexto de aprovacao pra solicitacao ${solicitacaoId}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}
