import { NotFoundException } from '@nestjs/common';
import { ClienteFinanceiroService } from './cliente-financeiro.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function decimalFake(valor: number) {
  return { toNumber: () => valor };
}

function prismaFake(cliente: Record<string, unknown> | null | undefined) {
  return {
    cliente: {
      findFirst: jest.fn().mockResolvedValue(
        cliente === undefined
          ? {
              idExternoErp: 'ext-1',
              limiteCredito: decimalFake(600),
              dataLimiteCredito: new Date('2026-08-01T00:00:00.000Z'),
            }
          : cliente,
      ),
    },
  };
}

function erpClientFake(porSituacao: Record<string, { valor: number; valorBaixado: number }[]>) {
  return {
    get: jest.fn(async (_path: string, params: { Situacao: string[] }) => {
      const [situacao] = params.Situacao;
      return porSituacao[situacao] ?? [];
    }),
  };
}

describe('ClienteFinanceiroService.obter', () => {
  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const service = new ClienteFinanceiroService(
      prismaFake(null) as never,
      erpClientFake({}) as never,
    );

    await expect(service.obter('inexistente', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o ERP quando o escopo e NENHUM', async () => {
    const prisma = prismaFake(undefined);
    const erpClient = erpClientFake({});
    const service = new ClienteFinanceiroService(prisma as never, erpClient as never);

    await expect(service.obter('c1', { tipo: 'NENHUM' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(erpClient.get).not.toHaveBeenCalled();
  });

  it('retorna limiteCredito do cadastro local e soma os titulos em aberto/vencidos do ERP', async () => {
    const prisma = prismaFake(undefined);
    const erpClient = erpClientFake({
      EmAberto: [{ valor: 100, valorBaixado: 0 }, { valor: 50, valorBaixado: 20 }],
      Vencidos: [{ valor: 200, valorBaixado: 0 }],
    });
    const service = new ClienteFinanceiroService(prisma as never, erpClient as never);

    const resultado = await service.obter('c1', ESCOPO_TODOS);

    expect(resultado).toEqual({
      clienteId: 'c1',
      limiteCredito: 600,
      dataLimiteCredito: '2026-08-01T00:00:00.000Z',
      notasEmAberto: { quantidade: 2, valorTotal: 130 },
      notasVencidas: { quantidade: 1, valorTotal: 200 },
      inadimplente: true,
    });
    expect(erpClient.get).toHaveBeenNthCalledWith(
      1,
      '/financeiro/v1/titulo-contas-receber',
      { IdSacado: 'ext-1', Situacao: ['EmAberto'], Fields: ['id', 'valor', 'valorBaixado'] },
    );
  });

  it('inadimplente e false e limiteCredito/dataLimiteCredito sao null quando nao ha nenhum dado', async () => {
    const prisma = prismaFake({
      idExternoErp: 'ext-2',
      limiteCredito: null,
      dataLimiteCredito: null,
    });
    const erpClient = erpClientFake({});
    const service = new ClienteFinanceiroService(prisma as never, erpClient as never);

    const resultado = await service.obter('c2', ESCOPO_TODOS);

    expect(resultado.limiteCredito).toBeNull();
    expect(resultado.dataLimiteCredito).toBeNull();
    expect(resultado.inadimplente).toBe(false);
    expect(resultado.notasEmAberto).toEqual({ quantidade: 0, valorTotal: 0 });
  });
});
