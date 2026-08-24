import { DispositivosService } from './dispositivos.service';

const IDP_USER_FAKE = {
  sub: 'sub-123',
  email: 'pessoa@copperline.com.br',
  name: 'Pessoa Teste',
  role: null,
  system: 'web',
};

describe('DispositivosService.registrar', () => {
  it('resolve/cria o usuario local e faz upsert do dispositivo por token', async () => {
    const prisma = { dispositivoUsuario: { upsert: jest.fn().mockResolvedValue(undefined) } };
    const usuariosService = {
      obterOuCriarPorSub: jest.fn().mockResolvedValue({ id: 'usuario-1' }),
    };
    const service = new DispositivosService(prisma as never, usuariosService as never);

    await service.registrar(IDP_USER_FAKE, { token: 'token-abc', plataforma: 'ANDROID' });

    expect(usuariosService.obterOuCriarPorSub).toHaveBeenCalledWith(IDP_USER_FAKE);
    expect(prisma.dispositivoUsuario.upsert).toHaveBeenCalledWith({
      where: { token: 'token-abc' },
      create: { token: 'token-abc', plataforma: 'ANDROID', usuarioId: 'usuario-1' },
      update: { plataforma: 'ANDROID', usuarioId: 'usuario-1' },
    });
  });
});
