import { NotFoundException } from '@nestjs/common';
import { ClienteFinanceiroService } from './cliente-financeiro.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import type { PosicaoFinanceiraBruta } from '../financeiro-svc-client/financeiro-svc-client.types';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function prismaFake(cliente: Record<string, unknown> | null | undefined) {
  return {
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue(cliente === undefined ? { idExternoErp: 'ext-1' } : cliente),
    },
  };
}

function posicaoFake(overrides: Partial<PosicaoFinanceiraBruta> = {}): PosicaoFinanceiraBruta {
  return {
    ValorLimite: 50000,
    ValorLimiteSerasa: 0,
    ValorCreditoDisponivel: 32000,
    ValorCreditoUtilizado: 18000,
    ValorSaldoAVencer: 15000,
    ValorSaldoVencido: 0,
    ValorMaiorAtraso: 0,
    MediaAtraso: 0,
    QtdeBaixasPorInadimplencia: 0,
    ValorTotalDeCompras: 250000,
    DataUltimaFatura: '2026-08-15',
    VendaBloqueada: false,
    ...overrides,
  };
}

function financeiroSvcClientFake(posicao: PosicaoFinanceiraBruta | null) {
  return { buscarPosicaoFinanceira: jest.fn().mockResolvedValue(posicao) };
}

describe('ClienteFinanceiroService.obter', () => {
  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const service = new ClienteFinanceiroService(
      prismaFake(null) as never,
      financeiroSvcClientFake(null) as never,
    );

    await expect(service.obter('inexistente', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o Financeiro.svc quando o escopo e NENHUM', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = financeiroSvcClientFake(posicaoFake());
    const service = new ClienteFinanceiroService(prisma as never, financeiroSvcClient as never);

    await expect(service.obter('c1', { tipo: 'NENHUM' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(financeiroSvcClient.buscarPosicaoFinanceira).not.toHaveBeenCalled();
  });

  it('lanca NotFoundException quando o Financeiro.svc nao retorna posicao pro cliente', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = financeiroSvcClientFake(null);
    const service = new ClienteFinanceiroService(prisma as never, financeiroSvcClient as never);

    await expect(service.obter('c1', ESCOPO_TODOS)).rejects.toThrow(NotFoundException);
  });

  it('mapeia a posicao financeira do Financeiro.svc pro DTO, buscando pelo idExternoErp do cliente', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = financeiroSvcClientFake(
      posicaoFake({ ValorSaldoVencido: 3000 }),
    );
    const service = new ClienteFinanceiroService(prisma as never, financeiroSvcClient as never);

    const resultado = await service.obter('c1', ESCOPO_TODOS);

    expect(financeiroSvcClient.buscarPosicaoFinanceira).toHaveBeenCalledWith('ext-1');
    expect(resultado).toEqual({
      clienteId: 'c1',
      limiteCredito: 50000,
      limiteCreditoSerasa: 0,
      creditoDisponivel: 32000,
      creditoUtilizado: 18000,
      saldoAVencer: 15000,
      saldoVencido: 3000,
      maiorAtraso: 0,
      mediaAtraso: 0,
      qtdeBaixasPorInadimplencia: 0,
      totalDeCompras: 250000,
      dataUltimaFatura: '2026-08-15',
      vendaBloqueada: false,
      inadimplente: true,
    });
  });

  it('inadimplente e false quando nao ha saldo vencido', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = financeiroSvcClientFake(
      posicaoFake({ ValorSaldoVencido: 0 }),
    );
    const service = new ClienteFinanceiroService(prisma as never, financeiroSvcClient as never);

    const resultado = await service.obter('c1', ESCOPO_TODOS);

    expect(resultado.inadimplente).toBe(false);
  });
});
