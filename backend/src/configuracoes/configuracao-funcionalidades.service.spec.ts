import { ConfiguracaoFuncionalidadesService } from './configuracao-funcionalidades.service';

const linha = (overrides: Record<string, unknown> = {}) => ({
  id: 'cfg-1',
  envioPedidosHabilitado: true,
  cadastroClientesHabilitado: true,
  atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

function prismaFake(existente: Record<string, unknown> | null) {
  return {
    configuracaoFuncionalidades: {
      findFirst: jest.fn().mockResolvedValue(existente),
      create: jest.fn().mockResolvedValue(linha()),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        linha(data),
      ),
    },
  };
}

describe('ConfiguracaoFuncionalidadesService', () => {
  it('sem linha cria com tudo habilitado (comportamento de sempre)', async () => {
    const prisma = prismaFake(null);

    const config = await new ConfiguracaoFuncionalidadesService(prisma as never).obter();

    expect(prisma.configuracaoFuncionalidades.create).toHaveBeenCalledWith({ data: {} });
    expect(config).toMatchObject({ envioPedidosHabilitado: true, cadastroClientesHabilitado: true });
  });

  it('atualizar grava os dois valores na linha existente', async () => {
    const prisma = prismaFake(linha());

    const config = await new ConfiguracaoFuncionalidadesService(prisma as never).atualizar({
      envioPedidosHabilitado: false,
      cadastroClientesHabilitado: true,
    });

    expect(prisma.configuracaoFuncionalidades.update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { envioPedidosHabilitado: false, cadastroClientesHabilitado: true },
    });
    expect(config.envioPedidosHabilitado).toBe(false);
  });
});
