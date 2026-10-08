import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AcessosService, CHAVE_BLOQUEADOS, idDaSessao } from './acessos.service';

function jwt(sub: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'RS256' })}.${b64({ sub })}.sig`;
}

function sessaoJson(sub: string, extra: object = {}) {
  return JSON.stringify({ idpAuth: { accessToken: jwt(sub) }, ...extra });
}

function montar(sessoes: Record<string, string> = {}, usuarios: Record<string, unknown>[] = []) {
  const store = { ...sessoes };
  const redis = {
    scan: jest.fn().mockImplementation(async () => ['0', Object.keys(store)]),
    mget: jest.fn().mockImplementation(async (chaves: string[]) => chaves.map((c) => store[c] ?? null)),
    del: jest.fn().mockImplementation(async (...chaves: string[]) => {
      chaves.forEach((c) => delete store[c]);
    }),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    sismember: jest.fn().mockResolvedValue(0),
  };
  const prisma = {
    usuario: {
      findMany: jest.fn().mockResolvedValue(usuarios),
      findUnique: jest
        .fn()
        .mockImplementation(async ({ where }: { where: { id: string } }) =>
          usuarios.find((u) => u.id === where.id) ?? null,
        ),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  return { service: new AcessosService(prisma as never, redis as never), redis, prisma, store };
}

const ANA = { id: 'u-ana', sub: 'sub-ana', nome: 'Ana', email: 'ana@x.com', bloqueado: false, bloqueadoEm: null, motivoBloqueio: null, _count: { dispositivos: 2 } };
const BETO = { id: 'u-beto', sub: 'sub-beto', nome: 'Beto', email: 'beto@x.com', bloqueado: false, bloqueadoEm: null, motivoBloqueio: null, _count: { dispositivos: 0 } };

describe('AcessosService.listar', () => {
  it('junta cada conta com as sessoes ativas dela (mais recente primeiro) e nunca expoe o id cru', async () => {
    const acesso = (ultimo: string) => ({
      acesso: { plataforma: 'mobile', dispositivo: 'Aplicativo Copperline', ip: '1.1.1.1', criadoEm: ultimo, ultimoAcessoEm: ultimo },
    });
    const { service } = montar(
      {
        'session:a1': sessaoJson('sub-ana', acesso('2026-10-08T10:00:00.000Z')),
        'session:a2': sessaoJson('sub-ana', acesso('2026-10-08T12:00:00.000Z')),
        'session:b1': sessaoJson('sub-beto'),
        'session:oauth': JSON.stringify({ idpAuthState: 'x' }),
      },
      [ANA, BETO],
    );

    const contas = await service.listar();

    expect(contas[0].sessoes.map((s) => s.ultimoAcessoEm)).toEqual([
      '2026-10-08T12:00:00.000Z',
      '2026-10-08T10:00:00.000Z',
    ]);
    expect(contas[0].dispositivosPush).toBe(2);
    expect(contas[1].sessoes).toHaveLength(1);
    expect(contas[1].sessoes[0].dispositivo).toMatch(/Sem registro/);
    expect(JSON.stringify(contas)).not.toContain('session:a1');
  });
});

describe('AcessosService.bloquear', () => {
  it('marca a conta, entra no conjunto de bloqueados e derruba todas as sessoes dela (so dela)', async () => {
    const { service, prisma, redis, store } = montar(
      { 'session:a1': sessaoJson('sub-ana'), 'session:a2': sessaoJson('sub-ana'), 'session:b1': sessaoJson('sub-beto') },
      [ANA, BETO],
    );

    await service.bloquear('u-ana', 'sub-admin', '  saiu da empresa ');

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-ana' },
        data: expect.objectContaining({ bloqueado: true, bloqueadoPorSub: 'sub-admin', motivoBloqueio: 'saiu da empresa' }),
      }),
    );
    expect(redis.sadd).toHaveBeenCalledWith(CHAVE_BLOQUEADOS, 'sub-ana');
    expect(Object.keys(store)).toEqual(['session:b1']);
  });

  it('admin nao pode bloquear a propria conta', async () => {
    const { service, prisma } = montar({}, [ANA]);

    await expect(service.bloquear('u-ana', 'sub-ana')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('conta inexistente: 404', async () => {
    const { service } = montar({}, []);

    await expect(service.bloquear('nada', 'sub-admin')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AcessosService.desbloquear / encerrarSessao / estaBloqueado', () => {
  it('desbloquear limpa o banco e tira do conjunto', async () => {
    const { service, prisma, redis } = montar({}, [ANA]);

    await service.desbloquear('u-ana');

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bloqueado: false, motivoBloqueio: null }) }),
    );
    expect(redis.srem).toHaveBeenCalledWith(CHAVE_BLOQUEADOS, 'sub-ana');
  });

  it('encerrarSessao apaga so a sessao do id informado', async () => {
    const { service, store } = montar({ 'session:a1': sessaoJson('sub-ana'), 'session:a2': sessaoJson('sub-ana') }, [ANA]);

    await service.encerrarSessao(idDaSessao('session:a1'));

    expect(Object.keys(store)).toEqual(['session:a2']);
  });

  it('encerrarSessao de id desconhecido: 404', async () => {
    const { service } = montar({ 'session:a1': sessaoJson('sub-ana') }, [ANA]);

    await expect(service.encerrarSessao('0000000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('estaBloqueado consulta o conjunto do Redis', async () => {
    const { service, redis } = montar();
    redis.sismember.mockResolvedValueOnce(1);

    await expect(service.estaBloqueado('sub-ana')).resolves.toBe(true);
    await expect(service.estaBloqueado('sub-beto')).resolves.toBe(false);
  });
});
