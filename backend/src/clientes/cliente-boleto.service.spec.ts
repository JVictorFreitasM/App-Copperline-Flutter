import { NotFoundException } from '@nestjs/common';
import { ClienteBoletoService } from './cliente-boleto.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { FinanceiroSvcFaultError } from '../financeiro-svc-client/financeiro-svc-fault.error';

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

function financeiroSvcClientFake(overrides: {
  tokens?: string[];
  buffer?: Buffer | null;
}) {
  return {
    buscarTokenBoleto: jest.fn().mockResolvedValue(overrides.tokens ?? ['tok-1']),
    downloadBoleto: jest
      .fn()
      .mockResolvedValue(overrides.buffer === undefined ? Buffer.from('pdf-falso') : overrides.buffer),
  };
}

describe('ClienteBoletoService.obter', () => {
  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const service = new ClienteBoletoService(
      prismaFake(null) as never,
      financeiroSvcClientFake({}) as never,
    );

    await expect(service.obter('inexistente', ESCOPO_TODOS, 'DOC-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o Financeiro.svc quando o escopo e NENHUM (IDOR)', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = financeiroSvcClientFake({});
    const service = new ClienteBoletoService(prisma as never, financeiroSvcClient as never);

    await expect(
      service.obter('c1', { tipo: 'NENHUM' }, 'DOC-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(financeiroSvcClient.buscarTokenBoleto).not.toHaveBeenCalled();
  });

  it('busca o token sempre com CodigoClienteSacado do cliente resolvido no escopo (nunca so o numeroDocumento)', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = financeiroSvcClientFake({});
    const service = new ClienteBoletoService(prisma as never, financeiroSvcClient as never);

    await service.obter('c1', ESCOPO_TODOS, 'DOC-1');

    expect(financeiroSvcClient.buscarTokenBoleto).toHaveBeenCalledWith({
      CodigoClienteSacado: 'ext-1',
      NumeroDocumento: 'DOC-1',
    });
  });

  it('retorna o buffer e o nome do arquivo quando o boleto e encontrado', async () => {
    const prisma = prismaFake(undefined);
    const buffer = Buffer.from('pdf-conteudo');
    const financeiroSvcClient = financeiroSvcClientFake({ tokens: ['tok-1'], buffer });
    const service = new ClienteBoletoService(prisma as never, financeiroSvcClient as never);

    const resultado = await service.obter('c1', ESCOPO_TODOS, 'DOC-1');

    expect(resultado).toEqual({ buffer, nomeArquivo: 'boleto-DOC-1.pdf' });
  });

  it('lanca NotFoundException quando nenhum token e encontrado pro documento', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = financeiroSvcClientFake({ tokens: [] });
    const service = new ClienteBoletoService(prisma as never, financeiroSvcClient as never);

    await expect(service.obter('c1', ESCOPO_TODOS, 'DOC-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(financeiroSvcClient.downloadBoleto).not.toHaveBeenCalled();
  });

  it('lanca NotFoundException quando o download nao retorna buffer', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = financeiroSvcClientFake({ tokens: ['tok-1'], buffer: null });
    const service = new ClienteBoletoService(prisma as never, financeiroSvcClient as never);

    await expect(service.obter('c1', ESCOPO_TODOS, 'DOC-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('converte fault do Financeiro.svc em NotFoundException, nunca deixa vazar como 500', async () => {
    const prisma = prismaFake(undefined);
    const financeiroSvcClient = {
      buscarTokenBoleto: jest
        .fn()
        .mockRejectedValue(
          new FinanceiroSvcFaultError('BuscarTokenBoleto', '3', 'Cliente nao encontrado'),
        ),
      downloadBoleto: jest.fn(),
    };
    const service = new ClienteBoletoService(prisma as never, financeiroSvcClient as never);

    await expect(service.obter('c1', ESCOPO_TODOS, 'DOC-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
