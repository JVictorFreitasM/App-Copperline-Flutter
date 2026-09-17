import { NotFoundException } from '@nestjs/common';
import { PagamentoService } from './pagamento.service';

function prismaFake(
  overrides: {
    formas?: unknown[];
    condicoes?: unknown[];
    formaEncontrada?: unknown;
    condicaoEncontrada?: unknown;
  } = {},
) {
  return {
    formaPagamento: {
      findMany: jest.fn().mockResolvedValue(overrides.formas ?? []),
      findUnique: jest.fn().mockResolvedValue(overrides.formaEncontrada ?? null),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: '1',
        codigo: '06',
        descricao: 'BOLETO',
        inativa: false,
        ...data,
      })),
    },
    condicaoPagamento: {
      findMany: jest.fn().mockResolvedValue(overrides.condicoes ?? []),
      findUnique: jest.fn().mockResolvedValue(overrides.condicaoEncontrada ?? null),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: '1',
        codigo: '401',
        nome: '28-BOLETO',
        validade: null,
        ...data,
      })),
    },
  };
}

describe('PagamentoService.listarFormasPagamento', () => {
  it('filtra so as ativas e nao desativadas manualmente', async () => {
    const prisma = prismaFake({
      formas: [{ id: '1', codigo: '06', descricao: 'BOLETO' }],
    });
    const service = new PagamentoService(prisma as never);

    const resultado = await service.listarFormasPagamento();

    expect(prisma.formaPagamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inativa: false, desativadaManualmente: false },
      }),
    );
    expect(resultado).toEqual([{ id: '1', codigo: '06', descricao: 'BOLETO' }]);
  });
});

describe('PagamentoService.listarCondicoesPagamento', () => {
  it('filtra condicoes sem validade OU com validade ainda no futuro, e nao desativadas manualmente', async () => {
    const prisma = prismaFake({
      condicoes: [
        {
          id: '1',
          codigo: '401',
          nome: '28-BOLETO',
          aVista: false,
          comEntrada: false,
          antecipada: false,
          parcelas: [{ percentual: 100, prazo: 28 }],
        },
      ],
    });
    const service = new PagamentoService(prisma as never);

    const resultado = await service.listarCondicoesPagamento();

    expect(prisma.condicaoPagamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          desativadaManualmente: false,
          OR: [{ validade: null }, { validade: { gte: expect.any(Date) } }],
        },
      }),
    );
    expect(resultado).toEqual([
      {
        id: '1',
        codigo: '401',
        nome: '28-BOLETO',
        aVista: false,
        comEntrada: false,
        antecipada: false,
        parcelas: [{ percentual: 100, prazo: 28 }],
      },
    ]);
  });
});

describe('PagamentoService.listarTodasFormasPagamento', () => {
  it('lista sem filtro (inclui inativas) e calcula ativo efetivo', async () => {
    const prisma = prismaFake({
      formas: [
        {
          id: '1',
          codigo: '06',
          descricao: 'BOLETO',
          inativa: false,
          desativadaManualmente: true,
        },
      ],
    });
    const service = new PagamentoService(prisma as never);

    const resultado = await service.listarTodasFormasPagamento();

    expect(prisma.formaPagamento.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ where: expect.anything() }),
    );
    expect(resultado).toEqual([
      {
        id: '1',
        codigo: '06',
        descricao: 'BOLETO',
        inativaNoErp: false,
        desativadaManualmente: true,
        ativo: false,
      },
    ]);
  });
});

describe('PagamentoService.atualizarAtivoFormaPagamento', () => {
  it('grava desativadaManualmente invertido de ativo', async () => {
    const prisma = prismaFake({
      formaEncontrada: { id: '1', inativa: false, desativadaManualmente: false },
    });
    const service = new PagamentoService(prisma as never);

    await service.atualizarAtivoFormaPagamento('1', false);

    expect(prisma.formaPagamento.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { desativadaManualmente: true },
    });
  });

  it('lanca NotFoundException quando o id nao existe', async () => {
    const prisma = prismaFake({ formaEncontrada: null });
    const service = new PagamentoService(prisma as never);

    await expect(service.atualizarAtivoFormaPagamento('inexistente', true)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.formaPagamento.update).not.toHaveBeenCalled();
  });
});

describe('PagamentoService.atualizarAtivoCondicaoPagamento', () => {
  it('grava desativadaManualmente invertido de ativo', async () => {
    const prisma = prismaFake({
      condicaoEncontrada: { id: '1', validade: null, desativadaManualmente: false },
    });
    const service = new PagamentoService(prisma as never);

    await service.atualizarAtivoCondicaoPagamento('1', false);

    expect(prisma.condicaoPagamento.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { desativadaManualmente: true },
    });
  });

  it('lanca NotFoundException quando o id nao existe', async () => {
    const prisma = prismaFake({ condicaoEncontrada: null });
    const service = new PagamentoService(prisma as never);

    await expect(
      service.atualizarAtivoCondicaoPagamento('inexistente', true),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.condicaoPagamento.update).not.toHaveBeenCalled();
  });
});
