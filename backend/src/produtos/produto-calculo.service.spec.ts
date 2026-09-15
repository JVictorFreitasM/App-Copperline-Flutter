import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProdutoCalculoService } from './produto-calculo.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function tipoAcondicionamentoFake(tamanhoPadrao: number | null) {
  return tamanhoPadrao === null ? null : { tamanhoPadrao: decimalFake(tamanhoPadrao) };
}

function prismaFake(produto: Record<string, unknown> | null) {
  return {
    produto: { findUnique: jest.fn().mockResolvedValue(produto) },
  };
}

function precoProdutoServiceFake(
  overrides: {
    precoTabela?: string | null;
    precoPorTabelaEspecifica?: string | null;
  } = {},
) {
  return {
    obterPrecoPorCodigo: jest.fn().mockResolvedValue(overrides.precoTabela ?? null),
    obterPrecoPorCodigoDeTabela: jest
      .fn()
      .mockResolvedValue(overrides.precoPorTabelaEspecifica ?? null),
  };
}

describe('ProdutoCalculoService.calcular', () => {
  it('lanca NotFoundException quando o produto nao existe', async () => {
    const prisma = prismaFake(null);
    const service = new ProdutoCalculoService(
      prisma as never,
      precoProdutoServiceFake() as never,
    );

    await expect(service.calcular('inexistente', 90)).rejects.toThrow(NotFoundException);
  });

  it('lanca UnprocessableEntityException quando o produto nao tem preco de venda (nem cru, nem na tabela)', async () => {
    const prisma = prismaFake({
      id: 'p1',
      codigo: 'C1',
      tipoAcondicionamento: tipoAcondicionamentoFake(30),
      precoVenda: null,
    });
    const service = new ProdutoCalculoService(
      prisma as never,
      precoProdutoServiceFake() as never,
    );

    await expect(service.calcular('p1', 90)).rejects.toThrow(UnprocessableEntityException);
  });

  // OS-novas-implementacoes.md Bloco 4 (revisao) - produto sem tipo de
  // acondicionamento associado se comporta como retalho (decisao
  // confirmada), nao bloqueia mais com UnprocessableEntityException.
  it('trata produto sem tipo de acondicionamento associado como retalho (livre)', async () => {
    const prisma = prismaFake({
      id: 'p1',
      codigo: 'C1',
      tipoAcondicionamento: null,
      precoVenda: decimalFake(10),
    });
    const service = new ProdutoCalculoService(
      prisma as never,
      precoProdutoServiceFake() as never,
    );

    const resultado = await service.calcular('p1', 90);

    expect(resultado).toEqual({
      quantidade: 90,
      unidade: 'METRO',
      valorUnitario: 10,
      valorFinal: 900,
      margemLucro: null,
    });
  });

  it('lanca BadRequestException quando o pedido nao fecha em multiplo do tamanhoPadrao', async () => {
    const prisma = prismaFake({
      id: 'p1',
      codigo: 'C1',
      tipoAcondicionamento: tipoAcondicionamentoFake(100),
      precoVenda: decimalFake(20),
    });
    const service = new ProdutoCalculoService(
      prisma as never,
      precoProdutoServiceFake() as never,
    );

    await expect(service.calcular('p1', 150)).rejects.toThrow(BadRequestException);
  });

  it('calcula corretamente um produto de tamanho fixo (delega pra funcao de dominio)', async () => {
    const prisma = prismaFake({
      id: 'p1',
      codigo: 'C1',
      tipoAcondicionamento: tipoAcondicionamentoFake(30),
      precoVenda: decimalFake(10),
    });
    const service = new ProdutoCalculoService(
      prisma as never,
      precoProdutoServiceFake() as never,
    );

    const resultado = await service.calcular('p1', 90);

    expect(resultado).toEqual({
      quantidade: 3,
      unidade: 'PECA',
      valorUnitario: 10,
      valorFinal: 900,
      margemLucro: null,
    });
  });

  it('calcula corretamente um produto retalho (tipo com tamanhoPadrao null)', async () => {
    const prisma = prismaFake({
      id: 'p1',
      codigo: 'C1',
      tipoAcondicionamento: { tamanhoPadrao: null },
      precoVenda: decimalFake(10),
    });
    const service = new ProdutoCalculoService(
      prisma as never,
      precoProdutoServiceFake() as never,
    );

    const resultado = await service.calcular('p1', 12.5);

    expect(resultado).toEqual({
      quantidade: 12.5,
      unidade: 'METRO',
      valorUnitario: 10,
      valorFinal: 125,
      margemLucro: null,
    });
  });

  it('usa o preco da tabela padrao em vez do precoVenda cru, quando existe', async () => {
    const prisma = prismaFake({
      id: 'p1',
      codigo: 'C1',
      tipoAcondicionamento: null,
      precoVenda: decimalFake(10),
    });
    const service = new ProdutoCalculoService(
      prisma as never,
      precoProdutoServiceFake({ precoTabela: '50' }) as never,
    );

    const resultado = await service.calcular('p1', 10);

    expect(resultado.valorFinal).toBe(500);
  });

  // OS-novas-implementacoes.md Bloco 1 - tabela especifica, desconto livre
  // e margem (sempre null - formula pendente).
  describe('com codigoTabela/percentualDesconto (Bloco 1)', () => {
    it('usa o preco da tabela ESPECIFICA informada, nao a padrao/global', async () => {
      const prisma = prismaFake({
        id: 'p1',
        codigo: 'C1',
        tipoAcondicionamento: null,
        precoVenda: decimalFake(10),
      });
      const precoProdutoService = precoProdutoServiceFake({
        precoTabela: '50',
        precoPorTabelaEspecifica: '80',
      });
      const service = new ProdutoCalculoService(prisma as never, precoProdutoService as never);

      const resultado = await service.calcular('p1', 10, { codigoTabela: '205' });

      expect(precoProdutoService.obterPrecoPorCodigoDeTabela).toHaveBeenCalledWith('205', 'C1');
      expect(resultado.valorUnitario).toBe(80);
      expect(resultado.valorFinal).toBe(800);
    });

    it('lanca UnprocessableEntityException (nao cai pro fallback) quando o produto nao tem preco NESSA tabela', async () => {
      const prisma = prismaFake({
        id: 'p1',
        codigo: 'C1',
        tipoAcondicionamento: null,
        precoVenda: decimalFake(10),
      });
      const precoProdutoService = precoProdutoServiceFake({
        precoTabela: '50',
        precoPorTabelaEspecifica: null,
      });
      const service = new ProdutoCalculoService(prisma as never, precoProdutoService as never);

      await expect(
        service.calcular('p1', 10, { codigoTabela: '205' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('aplica percentualDesconto sobre o valorFinal (livre, sem checar teto do item)', async () => {
      const prisma = prismaFake({
        id: 'p1',
        codigo: 'C1',
        tipoAcondicionamento: null,
        precoVenda: decimalFake(10),
      });
      const service = new ProdutoCalculoService(
        prisma as never,
        precoProdutoServiceFake() as never,
      );

      const resultado = await service.calcular('p1', 10, { percentualDesconto: 10 });

      expect(resultado.valorFinal).toBe(90);
    });

    it('margemLucro e sempre null (formula pendente de confirmacao)', async () => {
      const prisma = prismaFake({
        id: 'p1',
        codigo: 'C1',
        tipoAcondicionamento: null,
        precoVenda: decimalFake(10),
        precoFabricacao: decimalFake(5),
      });
      const service = new ProdutoCalculoService(
        prisma as never,
        precoProdutoServiceFake() as never,
      );

      const resultado = await service.calcular('p1', 10);

      expect(resultado.margemLucro).toBeNull();
    });
  });
});
