import { criarMiddlewareAcesso } from './acesso-sessao.middleware';

function jwt(sub: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'RS256' })}.${b64({ sub })}.sig`;
}

function montar(opcoes: { sessao?: Record<string, unknown> | undefined; bloqueado?: boolean; headers?: Record<string, string> }) {
  const sessao: (Record<string, unknown> & { destroy: jest.Mock }) | undefined = opcoes.sessao && {
    ...opcoes.sessao,
    destroy: jest.fn((cb: () => void) => cb()),
  };
  const req = { session: sessao, headers: opcoes.headers ?? {}, ip: '10.0.0.5' };
  const json = jest.fn();
  const res = { status: jest.fn().mockReturnValue({ json }) };
  const next = jest.fn();
  const middleware = criarMiddlewareAcesso({
    estaBloqueado: jest.fn().mockResolvedValue(opcoes.bloqueado ?? false),
  });
  return { middleware, req, res, next, json, sessao };
}

const LOGADA = { idpAuth: { accessToken: jwt('sub-ana') } };

describe('middleware de acesso', () => {
  it('sem sessao logada segue direto', async () => {
    const m = montar({ sessao: {} });

    await m.middleware(m.req as never, m.res as never, m.next);

    expect(m.next).toHaveBeenCalledTimes(1);
    expect(m.res.status).not.toHaveBeenCalled();
  });

  it('conta bloqueada: destroi a sessao e responde 403 CONTA_BLOQUEADA, sem seguir', async () => {
    const m = montar({ sessao: { ...LOGADA }, bloqueado: true });

    await m.middleware(m.req as never, m.res as never, m.next);

    expect(m.sessao!.destroy).toHaveBeenCalled();
    expect(m.res.status).toHaveBeenCalledWith(403);
    expect(m.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CONTA_BLOQUEADA' }));
    expect(m.next).not.toHaveBeenCalled();
  });

  it('registra aparelho, plataforma e ip na primeira requisicao da sessao', async () => {
    const m = montar({
      sessao: { ...LOGADA },
      headers: { 'x-cliente-user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Safari/537.36', 'x-cliente-ip': '200.1.1.1' },
    });

    await m.middleware(m.req as never, m.res as never, m.next);

    expect(m.sessao!.acesso).toMatchObject({ plataforma: 'web', dispositivo: 'Chrome 130 no Windows', ip: '200.1.1.1' });
    expect(m.next).toHaveBeenCalledTimes(1);
  });

  it('app mobile e identificado pelo header x-app-cliente', async () => {
    const m = montar({ sessao: { ...LOGADA }, headers: { 'x-app-cliente': 'mobile' } });

    await m.middleware(m.req as never, m.res as never, m.next);

    expect(m.sessao!.acesso).toMatchObject({ plataforma: 'mobile', ip: '10.0.0.5' });
  });

  it('nao regrava dentro de 1 minuto', async () => {
    const recente = new Date().toISOString();
    const acesso = { plataforma: 'web', dispositivo: 'x', ip: null, criadoEm: recente, ultimoAcessoEm: recente };
    const m = montar({ sessao: { ...LOGADA, acesso } });

    await m.middleware(m.req as never, m.res as never, m.next);

    expect(m.sessao!.acesso).toBe(acesso);
  });

  it('falha ao consultar o bloqueio nao derruba a requisicao', async () => {
    const m = montar({ sessao: { ...LOGADA } });
    const quebrado = criarMiddlewareAcesso({ estaBloqueado: jest.fn().mockRejectedValue(new Error('redis fora')) });

    await quebrado(m.req as never, m.res as never, m.next);

    expect(m.next).toHaveBeenCalledTimes(1);
    expect(m.res.status).not.toHaveBeenCalled();
  });
});
