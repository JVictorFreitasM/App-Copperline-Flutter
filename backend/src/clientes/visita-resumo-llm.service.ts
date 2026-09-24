import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { LlmClientService } from '../llm-client/llm-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { VisitasService } from '../visitas/visitas.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';

const TTL_CACHE_SEGUNDOS = 24 * 60 * 60;

// docs/casos-de-uso-ia.md secao 2.4 - unico dado de visita que e' texto
// livre de verdade e' `Visita.nota`; resumir isso ao longo de varias
// visitas de um cliente e' o caso onde LLM tem vantagem real sobre regra
// (diferente de verificacao de foto, fora de escopo). Mesmo padrao
// anti-alucinacao de ClienteResumoLlmService: usar so o texto presente,
// `dadosInsuficientes` como valvula de escape em vez de forcar conclusao
// quando nao ha nota (ou nota) suficiente.
const SYSTEM_PROMPT = `Você é um assistente de vendas B2B. Sua tarefa é analisar as notas de texto livre registradas por um vendedor em visitas anteriores a um cliente (fornecidas no formato JSON pela mensagem do usuário, da mais antiga pra mais recente) e gerar um resumo objetivo pra apoiar a próxima visita.

REGRAS OBRIGATÓRIAS:
- Use ESTRITAMENTE as notas fornecidas na mensagem do usuário. NUNCA invente, presuma ou infira informação que não esteja explicitamente presente nas notas (compromisso assumido, problema relatado, preferência do cliente, etc).
- Se não houver notas, ou as notas existentes forem curtas/vagas demais pra gerar um resumo ou pontos de atenção úteis, defina "dadosInsuficientes": true e explique isso no campo "resumo" - não force uma conclusão.
- Responda APENAS com um objeto JSON no formato: {"resumo": string, "pontosDeAtencao": string[], "dadosInsuficientes": boolean}.`;

const VisitaResumoSchema = z.object({
  resumo: z.string(),
  pontosDeAtencao: z.array(z.string()),
  dadosInsuficientes: z.boolean(),
});

export interface VisitaResumoLlmDto {
  clienteId: string;
  geradoEm: string;
  resumo: string;
  pontosDeAtencao: string[];
  dadosInsuficientes: boolean;
  quantidadeNotasConsideradas: number;
  fonteCache: boolean;
}

// Mesmo criterio de custo/cache de ClienteResumoLlmService (chamada de LLM
// paga a cada geracao) - cache de 24h no Redis, chave separada da de
// resumo de cliente (dado de entrada diferente).
@Injectable()
export class VisitaResumoLlmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visitasService: VisitasService,
    private readonly llmClientService: LlmClientService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // Mesmo criterio de escopo/404 de ClienteResumoLlmService.obterResumo -
  // "nao existe" e "existe mas fora do escopo" sempre viram 404, nunca 403.
  async obterResumo(
    clienteId: string,
    escopo: EscopoClientes,
  ): Promise<VisitaResumoLlmDto> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, ...whereEscopo },
      select: { id: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const chaveCache = `cache:resumo-visitas-cliente:${clienteId}`;
    const cacheado = await this.redis.get(chaveCache);
    if (cacheado) {
      const resumo = JSON.parse(cacheado) as VisitaResumoLlmDto;
      return { ...resumo, fonteCache: true };
    }

    // listarPorCliente ja aplica o mesmo escopo/404 acima (redundante aqui,
    // mas e' a unica forma publica do service de buscar as visitas) -
    // reaproveitada em vez de duplicar a query de Visita.
    const visitas = await this.visitasService.listarPorCliente(clienteId, escopo);
    const notas = visitas
      .filter((v) => v.nota && v.nota.trim().length > 0)
      .map((v) => ({ data: v.checkinEm, nota: v.nota as string }))
      // listarPorCliente ordena desc (mais recente primeiro) - inverte pra
      // dar ao LLM a ordem cronologica (mais antiga -> mais recente),
      // mais facil de "perceber evolucao" do que ordem reversa.
      .reverse();

    const resultado = await this.llmClientService.gerarJson(
      SYSTEM_PROMPT,
      JSON.stringify({ notasDeVisita: notas }),
      VisitaResumoSchema,
    );

    const resumo: VisitaResumoLlmDto = {
      clienteId,
      geradoEm: new Date().toISOString(),
      resumo: resultado.resumo,
      pontosDeAtencao: resultado.pontosDeAtencao,
      dadosInsuficientes: resultado.dadosInsuficientes,
      quantidadeNotasConsideradas: notas.length,
      fonteCache: false,
    };

    await this.redis.set(chaveCache, JSON.stringify(resumo), 'EX', TTL_CACHE_SEGUNDOS);
    return resumo;
  }
}
