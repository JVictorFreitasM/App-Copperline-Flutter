import { NotFoundException } from '@nestjs/common';
import { EstoqueService } from './estoque.service';

function prismaFake(
  produto: unknown,
  saldo: { quantidadeDisponivel: { toString(): string }; atualizadoEm: Date } | null = null,
) {
  return {
    produto: {
      findFirst: jest.fn().mockResolvedValue(produto),
    },
    saldoEstoque: {
      findUnique: jest.fn().mockResolvedValue(saldo),
    },
  };
}

describe('EstoqueService.consultarPorIdentificador', () => {
  it('lança NotFoundException quando o identificador não existe na tabela local', async () => {
    const prisma = prismaFake(null);
    const service = new EstoqueService(prisma as never);

    await expect(
      service.consultarPorIdentificador('inexistente'),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolve por Id (idExternoErp) pro codigo antes de consultar o saldo local', async () => {
    const produto = { id: 'uuid-1', idExternoErp: '123', codigo: 'PROD-1' };
    const prisma = prismaFake(produto, {
      quantidadeDisponivel: { toString: () => '10.5' },
      atualizadoEm: new Date('2026-08-21T10:00:00.000Z'),
    });
    const service = new EstoqueService(prisma as never);

    const resultado = await service.consultarPorIdentificador('123');

    expect(resultado.codigo).toBe('PROD-1');
    expect(resultado.itens[0].quantidade).toBe('10.5');
    expect(resultado.atualizadoEm).toBe('2026-08-21T10:00:00.000Z');
    expect(prisma.saldoEstoque.findUnique).toHaveBeenCalledWith({
      where: { codigoProduto: 'PROD-1' },
    });
  });

  it('retorna itens vazios e atualizadoEm null quando o produto existe mas nunca teve saldo sincronizado', async () => {
    const prisma = prismaFake({ id: 'uuid-1', idExternoErp: '1', codigo: 'PROD-1' }, null);
    const service = new EstoqueService(prisma as never);

    const resultado = await service.consultarPorIdentificador('PROD-1');

    expect(resultado.itens).toEqual([]);
    expect(resultado.atualizadoEm).toBeNull();
  });

  it('lança NotFoundException quando o produto local ainda não tem codigo (stub incompleto)', async () => {
    const prisma = prismaFake({ id: 'uuid-1', idExternoErp: '1', codigo: null });
    const service = new EstoqueService(prisma as never);

    await expect(service.consultarPorIdentificador('1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
