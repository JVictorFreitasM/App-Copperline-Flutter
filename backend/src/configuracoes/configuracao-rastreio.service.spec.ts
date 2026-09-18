import { ConfiguracaoRastreioService } from './configuracao-rastreio.service';

function linhaPadrao(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    desabilitarEdicaoHorarioTrabalhoAndroid: true,
    habilitarRastreamentoSabados: false,
    habilitarRastreamentoDomingos: false,
    horarioInicioRastreamento: '07:30',
    horarioTerminoRastreamento: '18:00',
    precisaoMinimaMetrosGps: 50,
    tempoMinimoAcordarGpsMs: 30000,
    permitirRegistroComGpsDesabilitado: false,
    distanciaMaximaClienteRegistroPedidoMetros: null,
    distanciaMaximaClienteRegistroVisitaMetros: 50,
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function prismaFake(linhaExistente: Record<string, unknown> | null = null) {
  const linha = linhaExistente ? { ...linhaExistente } : null;
  return {
    configuracaoRastreio: {
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

describe('ConfiguracaoRastreioService', () => {
  it('obter() cria a linha com defaults quando nao existe nenhuma', async () => {
    const prisma = prismaFake(null);
    const service = new ConfiguracaoRastreioService(prisma as never);

    const config = await service.obter();

    expect(prisma.configuracaoRastreio.create).toHaveBeenCalled();
    expect(config).toEqual({
      desabilitarEdicaoHorarioTrabalhoAndroid: true,
      habilitarRastreamentoSabados: false,
      habilitarRastreamentoDomingos: false,
      horarioInicioRastreamento: '07:30',
      horarioTerminoRastreamento: '18:00',
      precisaoMinimaMetrosGps: 50,
      tempoMinimoAcordarGpsMs: 30000,
      permitirRegistroComGpsDesabilitado: false,
      distanciaMaximaClienteRegistroPedidoMetros: null,
      distanciaMaximaClienteRegistroVisitaMetros: 50,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  it('atualizar() grava todos os campos, incluindo distancia de pedido null', async () => {
    const prisma = prismaFake(linhaPadrao());
    const service = new ConfiguracaoRastreioService(prisma as never);

    const config = await service.atualizar({
      desabilitarEdicaoHorarioTrabalhoAndroid: false,
      habilitarRastreamentoSabados: true,
      habilitarRastreamentoDomingos: true,
      horarioInicioRastreamento: '08:00',
      horarioTerminoRastreamento: '17:00',
      precisaoMinimaMetrosGps: 30,
      tempoMinimoAcordarGpsMs: 15000,
      permitirRegistroComGpsDesabilitado: true,
      distanciaMaximaClienteRegistroPedidoMetros: 100,
      distanciaMaximaClienteRegistroVisitaMetros: 75,
    });

    expect(prisma.configuracaoRastreio.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        desabilitarEdicaoHorarioTrabalhoAndroid: false,
        habilitarRastreamentoSabados: true,
        habilitarRastreamentoDomingos: true,
        horarioInicioRastreamento: '08:00',
        horarioTerminoRastreamento: '17:00',
        precisaoMinimaMetrosGps: 30,
        tempoMinimoAcordarGpsMs: 15000,
        permitirRegistroComGpsDesabilitado: true,
        distanciaMaximaClienteRegistroPedidoMetros: 100,
        distanciaMaximaClienteRegistroVisitaMetros: 75,
      },
    });
    expect(config.horarioInicioRastreamento).toBe('08:00');
    expect(config.distanciaMaximaClienteRegistroPedidoMetros).toBe(100);
  });
});
