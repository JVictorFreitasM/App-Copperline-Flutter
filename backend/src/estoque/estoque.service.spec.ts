import { NotFoundException } from '@nestjs/common';
import { EstoqueService } from './estoque.service';

function prismaFake(findFirst: unknown) {
  return {
    produto: {
      findFirst: jest.fn().mockResolvedValue(findFirst),
    },
  };
}

function configServiceFake(overrides: Record<string, string> = {}) {
  const valores: Record<string, string> = {
    WK_BI_HASH_SALDO_ESTOQUE: 'hash-fake',
    WK_BI_BASE: 'empresa-teste',
    ...overrides,
  };
  return {
    getOrThrow: jest.fn((chave: string) => {
      const valor = valores[chave];
      if (valor === undefined) {
        throw new Error(`Config ausente: ${chave}`);
      }
      return valor;
    }),
    get: jest.fn((chave: string) => valores[chave]),
  };
}

function wkBiClientFake(linhas: Record<string, unknown>[]) {
  return {
    buscarRelatorioExportacaoAutomatica: jest.fn().mockResolvedValue(linhas),
  };
}

describe('EstoqueService.consultarPorIdentificador', () => {
  it('lança NotFoundException quando o identificador não existe na tabela local', async () => {
    const prisma = prismaFake(null);
    const service = new EstoqueService(
      prisma as never,
      wkBiClientFake([]) as never,
      configServiceFake() as never,
    );

    await expect(
      service.consultarPorIdentificador('inexistente'),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolve por Id (idExternoErp) pro codigo antes de consultar o WK BI', async () => {
    const produto = {
      id: 'uuid-1',
      idExternoErp: '123',
      codigo: 'PROD-1',
    };
    const prisma = prismaFake(produto);
    const wkBiClient = wkBiClientFake([
      { Lote: 'L1', 'Fabricado Em': '2026-01-01', 'Qtde Estoque': '10.5' },
    ]);
    const service = new EstoqueService(
      prisma as never,
      wkBiClient as never,
      configServiceFake() as never,
    );

    const resultado = await service.consultarPorIdentificador('123');

    expect(resultado.codigo).toBe('PROD-1');
    expect(resultado.itens[0].quantidade).toBe('10.5');
    const configEnviado = (
      wkBiClient.buscarRelatorioExportacaoAutomatica.mock.calls[0] as [string]
    )[0];
    expect(configEnviado).toContain('"CodProdutos"="PROD-1"');
  });

  it('retorna itens vazios quando o produto existe mas não tem saldo (sem erro)', async () => {
    const prisma = prismaFake({
      id: 'uuid-1',
      idExternoErp: '1',
      codigo: 'PROD-1',
    });
    const service = new EstoqueService(
      prisma as never,
      wkBiClientFake([]) as never,
      configServiceFake() as never,
    );

    const resultado = await service.consultarPorIdentificador('PROD-1');

    expect(resultado.itens).toEqual([]);
  });

  it('lança NotFoundException quando o produto local ainda não tem codigo (stub incompleto)', async () => {
    const prisma = prismaFake({
      id: 'uuid-1',
      idExternoErp: '1',
      codigo: null,
    });
    const service = new EstoqueService(
      prisma as never,
      wkBiClientFake([]) as never,
      configServiceFake() as never,
    );

    await expect(service.consultarPorIdentificador('1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
