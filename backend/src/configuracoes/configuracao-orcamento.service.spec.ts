import { ConfiguracaoOrcamentoService } from './configuracao-orcamento.service';

function linhaPadrao(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    habilitarCriacaoOrcamento: true,
    permitirVendedorTransformarEmPedido: true,
    criarPedidoSugeridoComoOrcamento: true,
    permitirAlteracaoVendedorOrcamentoCriado: true,
    permitirItensRepetidos: false,
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function prismaFake(linhaExistente: Record<string, unknown> | null = null) {
  const linha = linhaExistente ? { ...linhaExistente } : null;
  return {
    configuracaoOrcamento: {
      findFirst: jest.fn().mockImplementation(async () => linha),
      create: jest.fn().mockImplementation(async () => linhaPadrao()),
      update: jest
        .fn()
        .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...(linha ?? linhaPadrao()),
          ...data,
          atualizadoEm: new Date('2026-01-02T00:00:00.000Z'),
        })),
    },
  };
}

describe('ConfiguracaoOrcamentoService', () => {
  it('obter() cria a linha com defaults (tudo habilitado) quando nao existe nenhuma', async () => {
    const prisma = prismaFake(null);
    const service = new ConfiguracaoOrcamentoService(prisma as never);

    const config = await service.obter();

    expect(prisma.configuracaoOrcamento.create).toHaveBeenCalled();
    expect(config).toEqual({
      habilitarCriacaoOrcamento: true,
      permitirVendedorTransformarEmPedido: true,
      criarPedidoSugeridoComoOrcamento: true,
      permitirAlteracaoVendedorOrcamentoCriado: true,
      permitirItensRepetidos: false,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  it('atualizar() grava os 5 campos', async () => {
    const prisma = prismaFake(linhaPadrao());
    const service = new ConfiguracaoOrcamentoService(prisma as never);

    const config = await service.atualizar({
      habilitarCriacaoOrcamento: false,
      permitirVendedorTransformarEmPedido: false,
      criarPedidoSugeridoComoOrcamento: true,
      permitirAlteracaoVendedorOrcamentoCriado: false,
      permitirItensRepetidos: true,
    });

    expect(prisma.configuracaoOrcamento.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        habilitarCriacaoOrcamento: false,
        permitirVendedorTransformarEmPedido: false,
        criarPedidoSugeridoComoOrcamento: true,
        permitirAlteracaoVendedorOrcamentoCriado: false,
        permitirItensRepetidos: true,
      },
    });
    expect(config.habilitarCriacaoOrcamento).toBe(false);
    expect(config.criarPedidoSugeridoComoOrcamento).toBe(true);
  });
});
