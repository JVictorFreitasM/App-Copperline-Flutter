import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProdutoCalculoService } from './produto-calculo.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function prismaFake(produto: Record<string, unknown> | null) {
  return {
    produto: { findUnique: jest.fn().mockResolvedValue(produto) },
  };
}

describe('ProdutoCalculoService.calcular', () => {
  it('lanca NotFoundException quando o produto nao existe', async () => {
    const prisma = prismaFake(null);
    const service = new ProdutoCalculoService(prisma as never);

    await expect(service.calcular('inexistente', 90)).rejects.toThrow(NotFoundException);
  });

  it('lanca UnprocessableEntityException quando o produto nao tem preco de venda', async () => {
    const prisma = prismaFake({
      id: 'p1',
      tipoVenda: 'POC',
      comprimentoMetros: decimalFake(30),
      precoVenda: null,
    });
    const service = new ProdutoCalculoService(prisma as never);

    await expect(service.calcular('p1', 90)).rejects.toThrow(UnprocessableEntityException);
  });

  it('lanca UnprocessableEntityException quando o produto nao tem tipoVenda configurado', async () => {
    const prisma = prismaFake({
      id: 'p1',
      tipoVenda: null,
      comprimentoMetros: decimalFake(30),
      precoVenda: decimalFake(10),
    });
    const service = new ProdutoCalculoService(prisma as never);

    await expect(service.calcular('p1', 90)).rejects.toThrow(UnprocessableEntityException);
  });

  it('lanca BadRequestException quando um produto KM nao fecha em unidade cheia', async () => {
    const prisma = prismaFake({
      id: 'p1',
      tipoVenda: 'KM',
      comprimentoMetros: decimalFake(100),
      precoVenda: decimalFake(20),
    });
    const service = new ProdutoCalculoService(prisma as never);

    await expect(service.calcular('p1', 150)).rejects.toThrow(BadRequestException);
  });

  it('calcula corretamente um produto POC (delega pra funcao de dominio)', async () => {
    const prisma = prismaFake({
      id: 'p1',
      tipoVenda: 'POC',
      comprimentoMetros: decimalFake(30),
      precoVenda: decimalFake(10),
    });
    const service = new ProdutoCalculoService(prisma as never);

    const resultado = await service.calcular('p1', 90);

    expect(resultado).toEqual({ quantidade: 3, unidade: 'PECA', valorTotal: 900 });
  });

  it('calcula corretamente um produto RET sem exigir comprimentoMetros', async () => {
    const prisma = prismaFake({
      id: 'p1',
      tipoVenda: 'RET',
      comprimentoMetros: null,
      precoVenda: decimalFake(10),
    });
    const service = new ProdutoCalculoService(prisma as never);

    const resultado = await service.calcular('p1', 12.5);

    expect(resultado).toEqual({ quantidade: 12.5, unidade: 'METRO', valorTotal: 125 });
  });
});
