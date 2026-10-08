import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProvedoresApiService } from './provedores-api.service';

type Linha = Record<string, unknown> & { id: string; tipo: string; ordem: number; ativa: boolean };

function montar(env: Record<string, string> = {}, linhas: Linha[] = []) {
  const banco = [...linhas];
  let seq = 0;
  const prisma = {
    provedorApi: {
      count: jest.fn(async ({ where }: { where: { tipo: string } }) => banco.filter((l) => l.tipo === where.tipo).length),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const linha = { id: `id-${++seq}`, ativa: true, ...data } as Linha;
        banco.push(linha);
        return linha;
      }),
      findMany: jest.fn(async ({ where }: { where?: { tipo?: string; ativa?: boolean } } = {}) =>
        banco
          .filter((l) => (!where?.tipo || l.tipo === where.tipo) && (where?.ativa === undefined || l.ativa === where.ativa))
          .sort((a, b) => a.ordem - b.ordem),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => banco.find((l) => l.id === where.id) ?? null),
      aggregate: jest.fn(async ({ where }: { where: { tipo: string } }) => ({
        _max: { ordem: Math.max(-1, ...banco.filter((l) => l.tipo === where.tipo).map((l) => l.ordem)) },
      })),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const linha = banco.find((l) => l.id === where.id)!;
        for (const [k, v] of Object.entries(data)) if (v !== undefined) (linha as Record<string, unknown>)[k] = v;
        return linha;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { id: string; tipo: string }; data: { ordem: number } }) => {
        const linha = banco.find((l) => l.id === where.id && l.tipo === where.tipo);
        if (linha) linha.ordem = data.ordem;
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        banco.splice(banco.findIndex((l) => l.id === where.id), 1);
      }),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const crypto = {
    criptografar: jest.fn((t: string) => `enc(${t})`),
    descriptografar: jest.fn((c: string) => c.replace(/^enc\(|\)$/g, '')),
  };
  const config = { get: (k: string) => env[k] };
  const service = new ProvedoresApiService(prisma as never, crypto as never, config as never);
  return { service, prisma, banco };
}

describe('ProvedoresApiService', () => {
  it('primeira subida: cada tipo vazio recebe os provedores padrao, usando as env antigas como valor inicial', async () => {
    const { service } = montar({ RECEITAWS_TOKEN: 'tok-env', RECEITAWS_LIMITE: '5' });
    await service.onModuleInit();

    const cnpj = await service.cadeia('CNPJ');

    expect(cnpj.map((p) => p.formato)).toEqual(['RECEITAWS', 'BRASILAPI']);
    expect(cnpj[0]).toMatchObject({ token: 'tok-env', limiteRequisicoes: 5, janelaSegundos: 60 });
    expect((await service.cadeia('CEP')).map((p) => p.formato)).toEqual(['MILEENA', 'VIACEP']);
    expect((await service.cadeia('GEOCODIFICACAO')).map((p) => p.formato)).toEqual(['NOMINATIM']);
  });

  it('nao recria padroes se o tipo ja tem provedores (edicao do admin e preservada)', async () => {
    const { service, banco } = montar({}, [
      { id: 'x', tipo: 'CEP', formato: 'MILEENA', ordem: 0, ativa: true },
    ]);
    await service.onModuleInit();

    expect(banco.filter((l) => l.tipo === 'CEP')).toHaveLength(1);
  });

  it('cadeia devolve so os ativos, em ordem, e a listagem nunca expoe o token', async () => {
    const { service } = montar();
    await service.onModuleInit();
    const [primeiro] = await service.cadeia('CEP');
    await service.atualizar(primeiro.id, { token: 'segredo', ativa: false });

    const cadeia = await service.cadeia('CEP');
    const listagem = JSON.stringify(await service.listar());

    expect(cadeia.map((p) => p.formato)).toEqual(['VIACEP']);
    expect(listagem).not.toContain('segredo');
    expect(listagem).toContain('"tokenDefinido":true');
  });

  it('criar valida o formato do tipo, normaliza a URL e entra no fim da cadeia', async () => {
    const { service } = montar();
    await service.onModuleInit();

    await expect(
      service.criar({ tipo: 'CEP', formato: 'RECEITAWS', rotulo: 'x', urlBase: 'https://a.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.criar({ tipo: 'CEP', formato: 'VIACEP', rotulo: 'x', urlBase: 'ftp://a.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const criado = await service.criar({ tipo: 'CEP', formato: 'VIACEP', rotulo: 'Meu mirror', urlBase: ' https://a.com/ws// ' });

    expect(criado).toMatchObject({ urlBase: 'https://a.com/ws', ordem: 2, ativa: true });
  });

  it('token vazio no PATCH remove; ausente mantem', async () => {
    const { service } = montar();
    await service.onModuleInit();
    const [p] = await service.cadeia('CNPJ');
    await service.atualizar(p.id, { token: 'novo' });
    await service.atualizar(p.id, { rotulo: 'ReceitaWS plano pago' });
    expect((await service.cadeia('CNPJ'))[0].token).toBe('novo');

    await service.atualizar(p.id, { token: '' });

    expect((await service.cadeia('CNPJ'))[0].token).toBeNull();
  });

  it('reordenar muda a ordem de tentativa; remover e atualizar de id inexistente dao 404', async () => {
    const { service } = montar();
    await service.onModuleInit();
    const [a, b] = await service.cadeia('CEP');

    await service.reordenar('CEP', [b.id, a.id]);

    expect((await service.cadeia('CEP')).map((p) => p.id)).toEqual([b.id, a.id]);
    await expect(service.remover('nao-existe')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.atualizar('nao-existe', { ativa: false })).rejects.toBeInstanceOf(NotFoundException);
  });
});
