import { ConfiguracaoDescontoService } from './configuracao-desconto.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function linhaPadrao(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    limitePercentual: decimalFake(20),
    habilitarAprovacaoPorAlcada: true,
    percentualAlcadaGerencial: decimalFake(50),
    percentualAlcadaSupervisao: decimalFake(50),
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function prismaFake(linhaExistente: Record<string, unknown> | null = null) {
  const linha = linhaExistente ? { ...linhaExistente } : null;
  return {
    configuracaoDesconto: {
      findFirst: jest.fn().mockImplementation(async () => linha),
      create: jest.fn().mockImplementation(async () => linhaPadrao()),
      update: jest
        .fn()
        .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...(linha ?? linhaPadrao()),
          ...(data.limitePercentual !== undefined && {
            limitePercentual: decimalFake(data.limitePercentual as number),
          }),
          ...(data.habilitarAprovacaoPorAlcada !== undefined && {
            habilitarAprovacaoPorAlcada: data.habilitarAprovacaoPorAlcada,
          }),
          ...(data.percentualAlcadaGerencial !== undefined && {
            percentualAlcadaGerencial: decimalFake(data.percentualAlcadaGerencial as number),
          }),
          ...(data.percentualAlcadaSupervisao !== undefined && {
            percentualAlcadaSupervisao: decimalFake(data.percentualAlcadaSupervisao as number),
          }),
          atualizadoEm: new Date('2026-01-02T00:00:00.000Z'),
        })),
    },
  };
}

describe('ConfiguracaoDescontoService', () => {
  it('obter() cria a linha com defaults quando nao existe nenhuma', async () => {
    const prisma = prismaFake(null);
    const service = new ConfiguracaoDescontoService(prisma as never);

    const config = await service.obter();

    expect(prisma.configuracaoDesconto.create).toHaveBeenCalled();
    expect(config).toEqual({
      limitePercentual: 20,
      habilitarAprovacaoPorAlcada: true,
      percentualAlcadaGerencial: 50,
      percentualAlcadaSupervisao: 50,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  it('atualizar() grava so o campo informado (uso ops, so limitePercentual)', async () => {
    const prisma = prismaFake(linhaPadrao());
    const service = new ConfiguracaoDescontoService(prisma as never);

    const config = await service.atualizar({ limitePercentual: 25 });

    expect(prisma.configuracaoDesconto.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { limitePercentual: 25 },
    });
    expect(config.limitePercentual).toBe(25);
    expect(config.percentualAlcadaGerencial).toBe(50);
  });

  it('atualizar() grava todos os campos da aba Alcada de Aprovacao (uso web)', async () => {
    const prisma = prismaFake(linhaPadrao());
    const service = new ConfiguracaoDescontoService(prisma as never);

    const config = await service.atualizar({
      limitePercentual: 14,
      habilitarAprovacaoPorAlcada: false,
      percentualAlcadaGerencial: 60,
      percentualAlcadaSupervisao: 45,
    });

    expect(prisma.configuracaoDesconto.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        limitePercentual: 14,
        habilitarAprovacaoPorAlcada: false,
        percentualAlcadaGerencial: 60,
        percentualAlcadaSupervisao: 45,
      },
    });
    expect(config).toEqual({
      limitePercentual: 14,
      habilitarAprovacaoPorAlcada: false,
      percentualAlcadaGerencial: 60,
      percentualAlcadaSupervisao: 45,
      atualizadoEm: '2026-01-02T00:00:00.000Z',
    });
  });

  it('obterLimitePercentual() devolve so o numero', async () => {
    const prisma = prismaFake(linhaPadrao());
    const service = new ConfiguracaoDescontoService(prisma as never);

    expect(await service.obterLimitePercentual()).toBe(20);
  });
});
