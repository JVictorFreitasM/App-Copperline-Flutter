import { UsuariosService } from './usuarios.service';

function prismaFake() {
  return {
    usuario: {
      upsert: jest.fn().mockImplementation(({ create }) => ({ id: 'u1', ...create })),
    },
  };
}

const IDP_USER_FAKE = {
  sub: 'sub-123',
  email: 'pessoa@copperline.com.br',
  name: 'Pessoa Teste',
  role: null,
  system: 'web',
};

describe('UsuariosService.obterOuCriarPorSub', () => {
  it('faz upsert por sub, usando email/name do IdP como fonte da verdade', async () => {
    const prisma = prismaFake();
    const service = new UsuariosService(prisma as never);

    await service.obterOuCriarPorSub(IDP_USER_FAKE);

    expect(prisma.usuario.upsert).toHaveBeenCalledWith({
      where: { sub: 'sub-123' },
      create: { sub: 'sub-123', email: 'pessoa@copperline.com.br', nome: 'Pessoa Teste' },
      update: { email: 'pessoa@copperline.com.br', nome: 'Pessoa Teste' },
    });
  });
});
