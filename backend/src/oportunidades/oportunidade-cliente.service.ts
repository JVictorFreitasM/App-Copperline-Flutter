import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { LlmClientService } from '../llm-client/llm-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  detectarAniversarioRelacionamento,
  detectarRecompraProxima,
  detectarSemPedidoHaDias,
  type CompraProduto,
  type MotivoOportunidade,
} from './domain/detectar-oportunidade';

const TTL_CACHE_SEGUNDOS = 24 * 60 * 60;
const LIMIAR_PADRAO_DIAS_SEM_PEDIDO = 45;

const SYSTEM_PROMPT = `Você é um assistente de vendas B2B. Você recebe (via mensagem do usuário) um motivo ESTRUTURAL já calculado por regra determinística explicando por que um cliente merece atenção do vendedor agora (ex: dias sem pedido, produto que costuma recomprar, aniversário de relacionamento).

REGRAS OBRIGATÓRIAS:
- Sua única tarefa é transformar esse motivo em UMA frase curta (1-2 linhas) de contexto para o vendedor, em português natural.
- Use ESTRITAMENTE os dados fornecidos. NUNCA invente número, produto ou fato que não esteja no JSON recebido.
- Você NUNCA decide se o cliente deveria ou não estar nesta lista - essa decisão já foi tomada antes de você ser chamado.
- Responda APENAS com um objeto JSON no formato: {"contexto": string}.`;

const ContextoSchema = z.object({ contexto: z.string() });

export interface OportunidadeClienteDto {
  clienteId: string;
  clienteNome: string | null;
  motivo: MotivoOportunidade;
  ultimaInteracaoEm: string | null;
  // null quando a geracao por IA falhou (ex: sem chave configurada) - o
  // motivo estrutural (regra deterministica) continua valido e exibido,
  // so a frase de contexto fica ausente, nunca inventada.
  contexto: string | null;
}

// OS-BACKEND-45 - GET /vendedores/:id/oportunidades. Quem entra na lista e'
// decidido 100% por regra deterministica (ver domain/detectar-oportunidade.ts);
// a chamada a LLM so' entra depois, por item, pra gerar a frase de contexto -
// nunca decide sozinha quem aparece.
@Injectable()
export class OportunidadeClienteService {
  private readonly logger = new Logger(OportunidadeClienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmClientService: LlmClientService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async listarParaVendedor(
    vendedorId: string,
    limiarDiasSemPedido: number = LIMIAR_PADRAO_DIAS_SEM_PEDIDO,
  ): Promise<OportunidadeClienteDto[]> {
    const clientes = await this.prisma.cliente.findMany({
      where: { inativo: false, vendedores: { some: { vendedorId } } },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
    });
    if (clientes.length === 0) {
      return [];
    }

    const pedidos = await this.prisma.pedido.findMany({
      where: { clienteId: { in: clientes.map((c) => c.id) } },
      orderBy: { dataHoraUltimaAlteracao: 'asc' },
      select: {
        clienteId: true,
        dataHoraUltimaAlteracao: true,
        itens: { select: { produtoId: true } },
      },
    });

    const pedidosPorCliente = new Map<string, typeof pedidos>();
    for (const pedido of pedidos) {
      if (!pedido.clienteId) continue;
      const lista = pedidosPorCliente.get(pedido.clienteId) ?? [];
      lista.push(pedido);
      pedidosPorCliente.set(pedido.clienteId, lista);
    }

    const hoje = new Date();
    const resultado: OportunidadeClienteDto[] = [];

    for (const cliente of clientes) {
      const pedidosCliente = pedidosPorCliente.get(cliente.id) ?? [];
      // Sem nenhum pedido ainda - "sem pedido ha N dias" nao se aplica (nao
      // ha data de referencia), e os outros dois criterios tambem
      // dependem de historico - sem historico nenhum, e' so ruido, nao
      // oportunidade real.
      if (pedidosCliente.length === 0) {
        continue;
      }

      const datas = pedidosCliente
        .map((p) => p.dataHoraUltimaAlteracao)
        .filter((d): d is Date => d !== null);
      const primeiroPedidoEm = datas[0] ?? null;
      const ultimoPedidoEm = datas[datas.length - 1] ?? null;

      const compras: CompraProduto[] = pedidosCliente.flatMap((p) =>
        p.dataHoraUltimaAlteracao
          ? p.itens
              .filter((item) => item.produtoId)
              .map((item) => ({
                produtoId: item.produtoId as string,
                data: p.dataHoraUltimaAlteracao as Date,
              }))
          : [],
      );

      const motivo =
        detectarSemPedidoHaDias(ultimoPedidoEm, hoje, limiarDiasSemPedido) ??
        detectarRecompraProxima(compras, hoje) ??
        detectarAniversarioRelacionamento(primeiroPedidoEm, hoje);
      if (!motivo) {
        continue;
      }

      resultado.push({
        clienteId: cliente.id,
        clienteNome: cliente.razaoSocial ?? cliente.nomeFantasia,
        motivo,
        ultimaInteracaoEm: ultimoPedidoEm?.toISOString() ?? null,
        contexto: await this.obterContexto(cliente.id, motivo),
      });
    }

    return resultado;
  }

  private async obterContexto(
    clienteId: string,
    motivo: MotivoOportunidade,
  ): Promise<string | null> {
    const chaveCache = `cache:oportunidade-contexto:${clienteId}:${motivo.tipo}`;
    const cacheado = await this.redis.get(chaveCache);
    if (cacheado) {
      return cacheado;
    }

    try {
      const resultado = await this.llmClientService.gerarJson(
        SYSTEM_PROMPT,
        JSON.stringify(motivo),
        ContextoSchema,
      );
      await this.redis.set(chaveCache, resultado.contexto, 'EX', TTL_CACHE_SEGUNDOS);
      return resultado.contexto;
    } catch (error) {
      // Falha na geracao do TEXTO (ex: sem chave de API configurada, ver
      // LlmClientService) nao derruba a lista inteira - o motivo
      // estrutural (regra deterministica) ja e' dado real e util sozinho;
      // so a frase de contexto fica ausente em vez de travar tudo.
      this.logger.warn(
        `Falha ao gerar contexto de oportunidade pro cliente ${clienteId}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}
