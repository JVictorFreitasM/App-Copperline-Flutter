import { of, throwError } from 'rxjs';
import { z } from 'zod';
import { LlmClientService } from './llm-client.service';

function configuracaoLlmServiceFake(
  overrides: { modelo?: string; fallbackAtivo?: boolean } = {},
) {
  return {
    obter: jest.fn().mockResolvedValue({
      provedor: 'openrouter',
      modelo: overrides.modelo ?? 'anthropic/claude-opus-5',
      fallbackAtivo: overrides.fallbackAtivo ?? true,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    }),
  };
}

function chaveLlmServiceFake(credenciais: { id: string; apiKey: string }[]) {
  return {
    listarCredenciaisAtivas: jest.fn().mockResolvedValue(credenciais),
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
  it('lanca erro claro quando nao ha nenhuma chave ativa configurada (fail-closed)', async () => {
    const service = new LlmClientService(
      httpServiceFake('{}') as never,
      configuracaoLlmServiceFake() as never,
      chaveLlmServiceFake([]) as never,
    );

    await expect(service.gerarJson('sys', 'user', SCHEMA_TESTE)).rejects.toThrow(
      /Nenhuma chave de API/,
    );
  });

  it('envia o modelo configurado e a credencial no header Authorization', async () => {
    const httpService = httpServiceFake(JSON.stringify({ resumo: 'ok' }));
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake({ modelo: 'openai/gpt-5' }) as never,
      chaveLlmServiceFake([{ id: 'chave-1', apiKey: 'sk-or-teste' }]) as never,
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
      configuracaoLlmServiceFake() as never,
      chaveLlmServiceFake([{ id: 'chave-1', apiKey: 'sk-or-teste' }]) as never,
    );

    const resultado = await service.gerarJson('sys', 'user', SCHEMA_TESTE);

    expect(resultado).toEqual({ resumo: 'cliente ok' });
  });

  it('lanca erro quando a resposta nao e JSON valido', async () => {
    const httpService = httpServiceFake('isso nao e json');
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake() as never,
      chaveLlmServiceFake([{ id: 'chave-1', apiKey: 'sk-or-teste' }]) as never,
    );

    await expect(service.gerarJson('sys', 'user', SCHEMA_TESTE)).rejects.toThrow(
      /não é um JSON válido/,
    );
  });

  it('lanca erro quando o JSON nao bate com o schema esperado (protecao contra alucinacao estrutural)', async () => {
    const httpService = httpServiceFake(JSON.stringify({ campoErrado: 123 }));
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake() as never,
      chaveLlmServiceFake([{ id: 'chave-1', apiKey: 'sk-or-teste' }]) as never,
    );

    await expect(service.gerarJson('sys', 'user', SCHEMA_TESTE)).rejects.toThrow(
      /não bateu com o formato esperado/,
    );
  });

  // 2026-09-24 - fallback em cadeia: chave 1 falha (ex: rate limit/chave
  // revogada), tenta a chave 2 e tem sucesso, sem propagar o erro da
  // primeira pro chamador.
  it('cai pra proxima chave da cadeia quando a primeira falha', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('401 Unauthorized')))
        .mockReturnValueOnce(of({ data: { choices: [{ message: { content: JSON.stringify({ resumo: 'ok' }) } }] } })),
    };
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake() as never,
      chaveLlmServiceFake([
        { id: 'chave-1', apiKey: 'sk-invalida' },
        { id: 'chave-2', apiKey: 'sk-valida' },
      ]) as never,
    );

    const resultado = await service.gerarJson('sys', 'user', SCHEMA_TESTE);

    expect(resultado).toEqual({ resumo: 'ok' });
    expect(httpService.post).toHaveBeenCalledTimes(2);
    const segundaChamada = httpService.post.mock.calls[1] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(segundaChamada[2].headers.Authorization).toBe('Bearer sk-valida');
  });

  it('propaga erro agregado quando TODAS as chaves da cadeia falham', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(throwError(() => new Error('503 indisponível'))),
    };
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake() as never,
      chaveLlmServiceFake([
        { id: 'chave-1', apiKey: 'sk-1' },
        { id: 'chave-2', apiKey: 'sk-2' },
      ]) as never,
    );

    await expect(service.gerarJson('sys', 'user', SCHEMA_TESTE)).rejects.toThrow(
      /Todas as 2 chave\(s\) de LLM ativa\(s\) falharam/,
    );
    expect(httpService.post).toHaveBeenCalledTimes(2);
  });

  // 2026-09-25 - switch "fallback ativo" desligado: so a primeira chave
  // (menor ordem) e' tentada, o erro dela propaga direto, nunca cai pra
  // proxima da lista mesmo havendo outra ativa.
  it('nao cai pra proxima chave quando fallbackAtivo esta desligado', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(throwError(() => new Error('401 Unauthorized'))),
    };
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake({ fallbackAtivo: false }) as never,
      chaveLlmServiceFake([
        { id: 'chave-1', apiKey: 'sk-invalida' },
        { id: 'chave-2', apiKey: 'sk-valida' },
      ]) as never,
    );

    await expect(service.gerarJson('sys', 'user', SCHEMA_TESTE)).rejects.toThrow(
      /Todas as 1 chave\(s\) de LLM ativa\(s\) falharam/,
    );
    expect(httpService.post).toHaveBeenCalledTimes(1);
    const primeiraChamada = httpService.post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(primeiraChamada[2].headers.Authorization).toBe('Bearer sk-invalida');
  });

  it('usa a primeira chave normalmente quando fallbackAtivo esta desligado mas ela funciona', async () => {
    const httpService = httpServiceFake(JSON.stringify({ resumo: 'ok' }));
    const service = new LlmClientService(
      httpService as never,
      configuracaoLlmServiceFake({ fallbackAtivo: false }) as never,
      chaveLlmServiceFake([
        { id: 'chave-1', apiKey: 'sk-1' },
        { id: 'chave-2', apiKey: 'sk-2' },
      ]) as never,
    );

    const resultado = await service.gerarJson('sys', 'user', SCHEMA_TESTE);

    expect(resultado).toEqual({ resumo: 'ok' });
    expect(httpService.post).toHaveBeenCalledTimes(1);
  });
});
