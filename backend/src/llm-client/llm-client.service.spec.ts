import { of } from 'rxjs';
import { z } from 'zod';
import { LlmClientService } from './llm-client.service';

function configuracaoLlmServiceFake(credenciais: {
  provedor?: string;
  apiKey: string | null;
  modelo?: string;
}) {
  return {
    obterCredenciais: jest.fn().mockResolvedValue({
      provedor: credenciais.provedor ?? 'openrouter',
      apiKey: credenciais.apiKey,
      modelo: credenciais.modelo ?? 'anthropic/claude-opus-5',
    }),
  };
}

function httpServiceFake(conteudo: string) {
  return {
    post: jest.fn().mockReturnValue(
      of({ data: { choices: [{ message: { content: conteudo } }] } }),
    ),
  };
}

const SCHEMA_TESTE = z.object({ resumo: z.string() });

describe('LlmClientService.gerarJson', () => {
  it('lanca erro claro quando nao ha apiKey configurada (fail-closed)', async () => {
    const service = new LlmClientService(
      httpServiceFake('{}') as never,
      configuracaoLlmServiceFake({ apiKey: null }) as never,
    );

    await expect(service.gerarJson('sys', 'user', SCHEMA_TESTE)).rejects.toThrow(
      /Nenhuma chave de API/,
    );
  });

  it('envia o modelo configurado e as credenciais no header Authorization', async () => {
    const httpService = httpServiceFake(JSON.stringify({ resumo: 'ok' }));
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake({ apiKey: 'sk-or-teste', modelo: 'openai/gpt-5' }) as never,
    );

    await service.gerarJson('instrucao do sistema', 'dados do usuario', SCHEMA_TESTE);

    const [url, corpo, opcoes] = httpService.post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(corpo.model).toBe('openai/gpt-5');
    expect(corpo.messages).toEqual([
      { role: 'system', content: 'instrucao do sistema' },
      { role: 'user', content: 'dados do usuario' },
    ]);
    expect(opcoes.headers.Authorization).toBe('Bearer sk-or-teste');
  });

  it('valida a resposta contra o schema Zod e retorna os dados tipados', async () => {
    const httpService = httpServiceFake(JSON.stringify({ resumo: 'cliente ok' }));
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake({ apiKey: 'sk-or-teste' }) as never,
    );

    const resultado = await service.gerarJson('sys', 'user', SCHEMA_TESTE);

    expect(resultado).toEqual({ resumo: 'cliente ok' });
  });

  it('lanca erro quando a resposta nao e JSON valido', async () => {
    const httpService = httpServiceFake('isso nao e json');
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake({ apiKey: 'sk-or-teste' }) as never,
    );

    await expect(service.gerarJson('sys', 'user', SCHEMA_TESTE)).rejects.toThrow(
      /não é um JSON válido/,
    );
  });

  it('lanca erro quando o JSON nao bate com o schema esperado (protecao contra alucinacao estrutural)', async () => {
    const httpService = httpServiceFake(JSON.stringify({ campoErrado: 123 }));
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake({ apiKey: 'sk-or-teste' }) as never,
    );

    await expect(service.gerarJson('sys', 'user', SCHEMA_TESTE)).rejects.toThrow(
      /não bateu com o formato esperado/,
    );
  });
});
