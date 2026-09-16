import { PagamentoService } from './pagamento.service';

function prismaFake(overrides: { formas?: unknown[]; condicoes?: unknown[] } = {}) {
  return {
    formaPagamento: {
      findMany: jest.fn().mockResolvedValue(overrides.formas ?? []),
    },
    condicaoPagamento: {
      findMany: jest.fn().mockResolvedValue(overrides.condicoes ?? []),
    },
  };
}

describe('PagamentoService.listarFormasPagamento', () => {
  it('filtra so as ativas (inativa: false) direto no banco', async () => {
    const prisma = prismaFake({
      formas: [{ id: '1', codigo: '06', descricao: 'BOLETO' }],
    });
    const service = new PagamentoService(prisma as never);

    const resultado = await service.listarFormasPagamento();

    expect(prisma.formaPagamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { inativa: false } }),
    );
    expect(resultado).toEqual([{ id: '1', codigo: '06', descricao: 'BOLETO' }]);
  });
});

describe('PagamentoService.listarCondicoesPagamento', () => {
  it('filtra condicoes sem validade OU com validade ainda no futuro', async () => {
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
