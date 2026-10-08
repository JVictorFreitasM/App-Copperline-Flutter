import { CredenciaisErpService } from './credenciais-erp.service';

function montar(env: Record<string, string> = {}, linhas: { chave: string; valorCifrado: string }[] = []) {
  const banco = [...linhas];
  const prisma = {
    credencialErp: {
      findMany: jest.fn().mockImplementation(async () => [...banco]),
      deleteMany: jest.fn().mockImplementation(async ({ where }: { where: { chave: string } }) => {
        const i = banco.findIndex((l) => l.chave === where.chave);
        if (i >= 0) banco.splice(i, 1);
      }),
      upsert: jest.fn().mockImplementation(async ({ create }: { create: { chave: string; valorCifrado: string } }) => {
        const i = banco.findIndex((l) => l.chave === create.chave);
        if (i >= 0) banco[i] = create;
        else banco.push(create);
      }),
    },
  };
  // "Criptografia" de teste, reversivel e distinguivel do texto plano.
  const crypto = {
    criptografar: jest.fn((t: string) => `enc(${t})`),
    descriptografar: jest.fn((c: string) => c.replace(/^enc\(|\)$/g, '')),
  };
  const config = { get: (k: string) => env[k] };
  const service = new CredenciaisErpService(prisma as never, crypto as never, config as never);
  return { service, prisma, crypto, banco };
}

describe('CredenciaisErpService', () => {
  it('sem nada no painel, vale a env', async () => {
    const { service } = montar({ WK_RADAR_USUARIO: 'env-user' });
    await service.onModuleInit();

    expect(service.getOrThrow('WK_RADAR_USUARIO')).toBe('env-user');
    expect(service.listar().find((c) => c.chave === 'WK_RADAR_USUARIO')).toMatchObject({
      origem: 'ambiente',
      valor: 'env-user',
    });
  });

  it('valor salvo no painel tem prioridade sobre a env e e gravado cifrado', async () => {
    const { service, banco } = montar({ WK_RADAR_USUARIO: 'env-user' });
    await service.onModuleInit();

    await service.salvar({ WK_RADAR_USUARIO: ' painel-user ' }, 'sub-admin');

    expect(banco[0].valorCifrado).toBe('enc(painel-user)');
    expect(service.getOrThrow('WK_RADAR_USUARIO')).toBe('painel-user');
    expect(service.listar().find((c) => c.chave === 'WK_RADAR_USUARIO')?.origem).toBe('painel');
  });

  it('senha nunca volta na listagem, so se esta definida', async () => {
    const { service } = montar();
    await service.onModuleInit();
    await service.salvar({ WK_BI_SENHA: 'segredo123' }, 'sub-admin');

    const senha = service.listar().find((c) => c.chave === 'WK_BI_SENHA')!;

    expect(senha).toMatchObject({ definida: true, valor: null, origem: 'painel' });
    expect(JSON.stringify(service.listar())).not.toContain('segredo123');
  });

  it('valor vazio remove o do painel e volta a valer a env; ausente nao mexe', async () => {
    const { service } = montar({ WK_BI_BASE: 'base-env' }, [{ chave: 'WK_BI_BASE', valorCifrado: 'enc(base-painel)' }]);
    await service.onModuleInit();
    expect(service.getOrThrow('WK_BI_BASE')).toBe('base-painel');

    await service.salvar({ WK_BI_USUARIO: undefined }, 'sub-admin');
    expect(service.getOrThrow('WK_BI_BASE')).toBe('base-painel');

    await service.salvar({ WK_BI_BASE: '' }, 'sub-admin');
    expect(service.getOrThrow('WK_BI_BASE')).toBe('base-env');
  });

  it('chave fora da lista permitida e recusada sem gravar nada', async () => {
    const { service, prisma } = montar();
    await service.onModuleInit();

    await expect(service.salvar({ DATABASE_URL: 'x' }, 'sub-admin')).rejects.toThrow(/desconhecida/);
    expect(prisma.credencialErp.upsert).not.toHaveBeenCalled();
  });

  it('getOrThrow falha com mensagem clara quando nao ha valor em lugar nenhum', async () => {
    const { service } = montar();
    await service.onModuleInit();

    expect(() => service.getOrThrow('WK_RADAR_EMPRESA')).toThrow(/nao configurada/);
  });

  it('versao sobe a cada gravacao (invalida o token do Radar)', async () => {
    const { service } = montar();
    await service.onModuleInit();
    const antes = service.versao;

    await service.salvar({ WK_RADAR_EMPRESA: '1' }, 'sub-admin');

    expect(service.versao).toBeGreaterThan(antes);
  });

  it('linha ilegivel (chave de criptografia trocada) cai na env sem derrubar o boot', async () => {
    const { service, crypto } = montar({ WK_BI_BASE: 'base-env' }, [{ chave: 'WK_BI_BASE', valorCifrado: 'lixo' }]);
    crypto.descriptografar.mockImplementation(() => {
      throw new Error('auth tag');
    });

    await service.onModuleInit();

    expect(service.getOrThrow('WK_BI_BASE')).toBe('base-env');
  });
});
