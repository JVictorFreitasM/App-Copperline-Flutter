import { NotFoundException } from '@nestjs/common';
import { ClienteEstatisticasService } from './cliente-estatisticas.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function prismaFake(overrides: {
  cliente?: Record<string, unknown> | null;
  agregadoGeral?: { _sum: { valorTotal: unknown }; _count: number };
  agregadoUltimosMeses?: { _sum: { valorTotal: unknown } };
} = {}) {
  const aggregate = jest
    .fn()
    .mockImplementationOnce(
      async () =>
        overrides.agregadoGeral ?? { _sum: { valorTotal: decimalFake(0) }, _count: 0 },
    )
    .mockImplementationOnce(
      async () => overrides.agregadoUltimosMeses ?? { _sum: { valorTotal: decimalFake(0) } },
    );

  return {
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'cliente' in overrides
            ? overrides.cliente
            : { id: 'c1', vendedores: [{ vendedor: { nome: 'Fulano' } }] },
        ),
    },
    pedido: { aggregate },
  };
}

describe('ClienteEstatisticasService.obter', () => {
  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new ClienteEstatisticasService(prisma as never);

    await expect(service.obter('inexistente', 12, ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new ClienteEstatisticasService(prisma as never);

    await expect(service.obter('c1', 12, { tipo: 'NENHUM' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('filtra pedidos CANCELADO, AGUARDANDO_APROVACAO e incompleto em todos os agregados', async () => {
    const prisma = prismaFake();
    const service = new ClienteEstatisticasService(prisma as never);

    await service.obter('c1', 12, ESCOPO_TODOS);

    expect(prisma.pedido.aggregate).toHaveBeenNthCalledWith(1, {
      where: {
        clienteId: 'c1',
        incompleto: false,
        situacao: { not: 'CANCELADO' },
        statusLocal: { not: 'AGUARDANDO_APROVACAO' },
      },
      _sum: { valorTotal: true },
      _count: true,
    });
    expect(prisma.pedido.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          clienteId: 'c1',
          incompleto: false,
          situacao: { not: 'CANCELADO' },
          statusLocal: { not: 'AGUARDANDO_APROVACAO' },
          dataHoraUltimaAlteracao: { gte: expect.any(Date) },
        }),
      }),
    );
  });

  it('calcula ticket medio como totalGeral / quantidadePedidos', async () => {
    const prisma = prismaFake({
      agregadoGeral: { _sum: { valorTotal: decimalFake(1000) }, _count: 4 },
      agregadoUltimosMeses: { _sum: { valorTotal: decimalFake(250) } },
    });
    const service = new ClienteEstatisticasService(prisma as never);

    const resultado = await service.obter('c1', 12, ESCOPO_TODOS);

    expect(resultado).toEqual({
      clienteId: 'c1',
      meses: 12,
      totalUltimosMeses: 250,
      totalGeral: 1000,
      quantidadePedidos: 4,
      ticketMedio: 250,
      vendedorResponsavel: 'Fulano',
    });
  });

  it('ticket medio e 0 quando nao ha nenhum pedido valido (sem divisao por zero)', async () => {
    const prisma = prismaFake({
      agregadoGeral: { _sum: { valorTotal: decimalFake(0) }, _count: 0 },
    });
    const service = new ClienteEstatisticasService(prisma as never);

    const resultado = await service.obter('c1', 12, ESCOPO_TODOS);

    expect(resultado.ticketMedio).toBe(0);
    expect(resultado.quantidadePedidos).toBe(0);
  });

  it('vendedorResponsavel e null quando o cliente nao tem vendedor vinculado', async () => {
    const prisma = prismaFake({ cliente: { id: 'c1', vendedores: [] } });
    const service = new ClienteEstatisticasService(prisma as never);

    const resultado = await service.obter('c1', 12, ESCOPO_TODOS);

    expect(resultado.vendedorResponsavel).toBeNull();
  });

  it('usa o mes informado no parametro pra calcular a janela de "ultimos N meses"', async () => {
    const prisma = prismaFake();
    const service = new ClienteEstatisticasService(prisma as never);

    const resultado = await service.obter('c1', 6, ESCOPO_TODOS);

    expect(resultado.meses).toBe(6);
  });

  // OS-BACKEND-35 - criterio de aceite explicito: meses=1 e meses=6
  // retornam janelas corretas (bordas do range 1-60 aceito pelo DTO).
  it('aceita meses=1 (borda minima) sem erro, aplicando a janela de 1 mes', async () => {
    const prisma = prismaFake();
    const service = new ClienteEstatisticasService(prisma as never);

    const resultado = await service.obter('c1', 1, ESCOPO_TODOS);

    expect(resultado.meses).toBe(1);
    const chamada = prisma.pedido.aggregate.mock.calls[1][0];
    const desdeEsperado = new Date();
    desdeEsperado.setMonth(desdeEsperado.getMonth() - 1);
    expect(chamada.where.dataHoraUltimaAlteracao.gte.getUTCMonth()).toBe(
      desdeEsperado.getUTCMonth(),
    );
  });
});
