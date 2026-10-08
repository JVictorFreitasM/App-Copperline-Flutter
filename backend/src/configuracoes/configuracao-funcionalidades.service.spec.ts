import { ConfiguracaoFuncionalidadesService } from './configuracao-funcionalidades.service';

const linha = (overrides: Record<string, unknown> = {}) => ({
  id: 'cfg-1',
  envioPedidosHabilitado: true,
  cadastroClientesHabilitado: true,
  envioClientesErpHabilitado: null,
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

const configFake = (env: Record<string, string> = {}) => ({ get: (k: string) => env[k] });

describe('ConfiguracaoFuncionalidadesService', () => {
  it('sem linha cria com tudo habilitado (comportamento de sempre)', async () => {
    const prisma = prismaFake(null);

    const config = await new ConfiguracaoFuncionalidadesService(prisma as never, configFake() as never).obter();

    expect(prisma.configuracaoFuncionalidades.create).toHaveBeenCalledWith({ data: {} });
    expect(config).toMatchObject({ envioPedidosHabilitado: true, cadastroClientesHabilitado: true });
  });

  it('atualizar grava os dois valores na linha existente', async () => {
    const prisma = prismaFake(linha());

    const config = await new ConfiguracaoFuncionalidadesService(prisma as never, configFake() as never).atualizar({
      envioPedidosHabilitado: false,
      cadastroClientesHabilitado: true,
      envioClientesErpHabilitado: true,
    });

    expect(prisma.configuracaoFuncionalidades.update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { envioPedidosHabilitado: false, cadastroClientesHabilitado: true, envioClientesErpHabilitado: true },
    });
    expect(config.envioPedidosHabilitado).toBe(false);
  });

  it('envio de clientes ao ERP: sem decisao no painel vale a env; decidido no painel vale o painel', async () => {
    const semDecisao = prismaFake(linha());
    const comEnvTrue = new ConfiguracaoFuncionalidadesService(
      semDecisao as never,
      configFake({ CLIENTE_ENVIO_ERP_HABILITADO: 'true' }) as never,
    );
    const semEnv = new ConfiguracaoFuncionalidadesService(semDecisao as never, configFake() as never);
    expect((await comEnvTrue.obter()).envioClientesErpHabilitado).toBe(true);
    expect((await semEnv.obter()).envioClientesErpHabilitado).toBe(false);

    const decidido = prismaFake(linha({ envioClientesErpHabilitado: false }));
    const painelDesligado = new ConfiguracaoFuncionalidadesService(
      decidido as never,
      configFake({ CLIENTE_ENVIO_ERP_HABILITADO: 'true' }) as never,
    );
    expect((await painelDesligado.obter()).envioClientesErpHabilitado).toBe(false);
  });
});
