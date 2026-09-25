import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import type { ZodType } from 'zod';
import { ChaveLlmService } from './chave-llm.service';
import { ConfiguracaoLlmService } from './configuracao-llm.service';

// OpenRouter (o "omniroute" da OS) - gateway compativel com o formato de
// chat completions da OpenAI, roteando pra Claude/GPT/etc so trocando o
// campo `model` (ex: "anthropic/claude-opus-5", "openai/gpt-5") - por isso
// um client HTTP so cobre "claude, gpt, etc" sem precisar de um SDK por
// provedor. Se o provedor configurado mudar pra algo com formato de
// request diferente no futuro, este e' o unico lugar a revisar.
const URL_CHAT_COMPLETIONS = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterChatResponse {
  choices?: { message?: { content?: string } }[];
}

// Client generico de LLM (OS-BACKEND-20) - fail-closed sem credencial
// configurada (mesmo padrao ja usado em PushNotificationClientService: erro
// so na hora de chamar, nunca no boot). Resposta sempre validada contra o
// schema Zod recebido do chamador antes de retornar - nunca repassa JSON
// malformado/fora do formato esperado adiante (protecao contra alucinacao
// estrutural, complementar a instrucao no prompt em si).
//
// 2026-09-24 - fallback em cadeia entre multiplas chaves (ChaveLlmService,
// aba "LLM" da tela de Configuracoes): tenta cada chave ATIVA em ordem
// crescente de `ordem`, parando na primeira que responder com sucesso.
// Falha de UMA chave (rate limit, chave revogada, timeout) nao derruba a
// chamada inteira enquanto houver outra na cadeia - so propaga erro quando
// TODAS falharem (ou nao houver nenhuma chave ativa configurada).
//
// 2026-09-25 - ConfiguracaoLlm.fallbackAtivo (switch na tela) liga/desliga
// esse comportamento: desligado, tenta SO a primeira chave ativa (menor
// `ordem`) e propaga o erro dela direto, sem cair pra proxima.
@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configuracaoLlmService: ConfiguracaoLlmService,
    private readonly chaveLlmService: ChaveLlmService,
  ) {}

  async gerarJson<T>(system: string, user: string, schema: ZodType<T>): Promise<T> {
    const [{ modelo, fallbackAtivo }, todasCredenciais] = await Promise.all([
      this.configuracaoLlmService.obter(),
      this.chaveLlmService.listarCredenciaisAtivas(),
    ]);
    if (todasCredenciais.length === 0) {
      throw new Error(
        'Nenhuma chave de API de LLM ativa configurada - configure ao menos uma na aba "LLM" de Configurações antes de chamar este recurso.',
      );
    }

    // fallbackAtivo desligado - so a primeira (menor `ordem`) e' tentada,
    // erro dela propaga direto (nunca cai pra proxima da lista).
    const credenciais = fallbackAtivo ? todasCredenciais : todasCredenciais.slice(0, 1);

    const erros: string[] = [];
    for (const credencial of credenciais) {
      try {
        return await this.chamarComChave(credencial.apiKey, modelo, system, user, schema);
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Chave de LLM '${credencial.id}' falhou, tentando a próxima da cadeia (se houver): ${mensagem}`,
        );
        erros.push(mensagem);
      }
    }

    throw new Error(
      `Todas as ${credenciais.length} chave(s) de LLM ativa(s) falharam: ${erros.join(' | ')}`,
    );
  }

  private async chamarComChave<T>(
    apiKey: string,
    modelo: string,
    system: string,
    user: string,
    schema: ZodType<T>,
  ): Promise<T> {
    const resposta = await firstValueFrom(
      this.httpService.post<OpenRouterChatResponse>(
        URL_CHAT_COMPLETIONS,
        {
          model: modelo,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
      ),
    );

    const conteudo = resposta.data.choices?.[0]?.message?.content;
    if (!conteudo) {
      throw new Error('Resposta do LLM sem conteúdo (choices[0].message.content vazio)');
    }

    let json: unknown;
    try {
      json = JSON.parse(conteudo);
    } catch {
      throw new Error('Resposta do LLM não é um JSON válido');
    }

    const resultado = schema.safeParse(json);
    if (!resultado.success) {
      this.logger.error(
        `Resposta do LLM não bateu com o schema esperado: ${resultado.error.message}`,
      );
      throw new Error('Resposta do LLM não bateu com o formato esperado');
    }

    return resultado.data;
  }
}
