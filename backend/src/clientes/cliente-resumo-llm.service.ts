import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { LlmClientService } from '../llm-client/llm-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

const TTL_CACHE_SEGUNDOS = 24 * 60 * 60;
const QUANTIDADE_PEDIDOS_RECENTES = 10;

// system prompt - a instrucao anti-alucinacao e' o ponto central (criterio
// de aceite da OS: "validar contra alucinacao - o prompt deve deixar claro
// que so pode usar o que foi passado"). `dadosInsuficientes` no schema de
// saida e' a valvula de escape explicita - o modelo tem um jeito de dizer
// "nao da pra concluir nada util" em vez de inventar pra preencher o campo.
const SYSTEM_PROMPT = `Você é um assistente de vendas B2B. Sua tarefa é analisar os dados de um cliente (fornecidos no formato JSON pela mensagem do usuário) e gerar um resumo objetivo para apoiar uma visita comercial.

REGRAS OBRIGATÓRIAS:
- Use ESTRITAMENTE os dados fornecidos na mensagem do usuário. NUNCA invente, presuma ou infira informação que não esteja explicitamente presente nos dados (nome de produto, motivo de rejeição, histórico não mencionado, etc).
- Se os dados fornecidos forem insuficientes para gerar pontos de atenção ou uma sugestão de abordagem úteis (ex: sem pedidos recentes, sem notas pendentes), defina "dadosInsuficientes": true e explique isso nos campos de texto - não force uma conclusão.
- Responda APENAS com um objeto JSON no formato: {"pontosDeAtencao": string[], "sugestaoAbordagem": string, "dadosInsuficientes": boolean}.`;

const ClienteResumoSchema = z.object({
  pontosDeAtencao: z.array(z.string()),
  sugestaoAbordagem: z.string(),
  dadosInsuficientes: z.boolean(),
});

export interface ClienteResumoLlmDto {
  clienteId: string;
  geradoEm: string;
  pontosDeAtencao: string[];
  sugestaoAbordagem: string;
  dadosInsuficientes: boolean;
  fonteCache: boolean;
}

// Custo de LLM so por abertura de tela seria caro/lento (OS-BACKEND-20:
// "cache do resumo... pra nao gerar custo a cada abertura") - cache de 24h
// no Redis compartilhado (REDIS_CLIENT, mesmo cliente ja usado por
// RateLimitGuard), chave por cliente.
@Injectable()
export class ClienteResumoLlmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmClientService: LlmClientService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async obterResumo(clienteId: string): Promise<ClienteResumoLlmDto> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const chaveCache = `cache:resumo-cliente:${clienteId}`;
    const cacheado = await this.redis.get(chaveCache);
    if (cacheado) {
      const resumo = JSON.parse(cacheado) as ClienteResumoLlmDto;
      return { ...resumo, fonteCache: true };
    }

    const dados = await this.coletarDados(clienteId);
    const resultado = await this.llmClientService.gerarJson(
      SYSTEM_PROMPT,
      JSON.stringify(dados),
      ClienteResumoSchema,
    );

    const resumo: ClienteResumoLlmDto = {
      clienteId,
      geradoEm: new Date().toISOString(),
      pontosDeAtencao: resultado.pontosDeAtencao,
      sugestaoAbordagem: resultado.sugestaoAbordagem,
      dadosInsuficientes: resultado.dadosInsuficientes,
      fonteCache: false,
    };

    await this.redis.set(chaveCache, JSON.stringify(resumo), 'EX', TTL_CACHE_SEGUNDOS);
    return resumo;
  }

  private async coletarDados(clienteId: string) {
    const [pedidos, notasFiscais, ticketMedio] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { clienteId },
        orderBy: { dataHoraUltimaAlteracao: 'desc' },
        take: QUANTIDADE_PEDIDOS_RECENTES,
        select: {
          numero: true,
          situacao: true,
          valorTotal: true,
          dataHoraUltimaAlteracao: true,
        },
      }),
      // Pendentes (aguardando autorizacao/erro de validacao) ou rejeitadas -
      // NotaFiscal nao tem clienteId direto, so via Pedido (ver schema.prisma).
      this.prisma.notaFiscal.findMany({
        where: {
          statusNfe: { in: ['AGUARDANDO_AUTORIZACAO', 'ERRO_VALIDACAO', 'REJEITADA'] },
          pedidos: { some: { pedido: { clienteId } } },
        },
        select: { numero: true, statusNfe: true, dataEmissao: true },
      }),
      this.prisma.pedido.aggregate({
        where: { clienteId },
        _avg: { valorTotal: true },
      }),
    ]);

    return {
      pedidosRecentes: pedidos.map((p) => ({
        numero: p.numero,
        situacao: p.situacao,
        valorTotal: p.valorTotal?.toString() ?? null,
        data: p.dataHoraUltimaAlteracao?.toISOString() ?? null,
      })),
      notasFiscaisPendentesOuRejeitadas: notasFiscais.map((n) => ({
        numero: n.numero,
        status: n.statusNfe,
        dataEmissao: n.dataEmissao?.toISOString() ?? null,
      })),
      ticketMedio: (ticketMedio._avg.valorTotal ?? 0).toString(),
    };
  }
}
