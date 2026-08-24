import { BuscaService } from './busca.service';

function prismaFake(overrides: {
  clientes?: unknown[];
  produtos?: unknown[];
  pedidos?: unknown[];
}) {
  return {
    cliente: { findMany: jest.fn().mockResolvedValue(overrides.clientes ?? []) },
    produto: { findMany: jest.fn().mockResolvedValue(overrides.produtos ?? []) },
    pedido: { findMany: jest.fn().mockResolvedValue(overrides.pedidos ?? []) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const CLIENTE_FAKE = {
  id: 'c1',
  idExternoErp: '1',
  cpfCnpj: '123',
  razaoSocial: 'Cliente Teste',
  nomeFantasia: null,
  inativo: false,
  incompleto: false,
  sincronizadoEm: new Date(),
};

const PRODUTO_FAKE = {
  id: 'p1',
  idExternoErp: '1',
  codigoIntegrador: null,
  codigo: 'COD-1',
  nome: 'Produto Teste',
  descricao: null,
  tipo: null,
  inativo: false,
  precoVenda: null,
  gtin: null,
  idGrade1: null,
  idGrade2: null,
  idGrade3: null,
  referenciasGrade: [],
  incompleto: false,
  sincronizadoEm: new Date(),
};

const PEDIDO_FAKE = {
  id: 'ped1',
  idExternoErp: '1',
  codigoIntegrador: null,
  numero: '999',
  situacao: null,
  dataHoraUltimaAlteracao: new Date(),
  clienteId: null,
  cliente: null,
  valorTotal: null,
  incompleto: false,
  sincronizadoEm: new Date(),
};

describe('BuscaService.buscar', () => {
  it('retorna os 3 tipos agrupados numa unica chamada', async () => {
    const prisma = prismaFake({
      clientes: [CLIENTE_FAKE],
      produtos: [PRODUTO_FAKE],
      pedidos: [PEDIDO_FAKE],
    });
    const service = new BuscaService(prisma as never);

    const resultado = await service.buscar('teste');

    expect(resultado.clientes).toHaveLength(1);
    expect(resultado.clientes[0].razaoSocial).toBe('Cliente Teste');
    expect(resultado.produtos).toHaveLength(1);
    expect(resultado.produtos[0].codigo).toBe('COD-1');
    expect(resultado.pedidos).toHaveLength(1);
    expect(resultado.pedidos[0].numero).toBe('999');
  });

  it('busca cliente por razaoSocial/nomeFantasia/cpfCnpj com ILIKE (contains insensitive)', async () => {
    const prisma = prismaFake({});
    const service = new BuscaService(prisma as never);

    await service.buscar('acme');

    expect(prisma.cliente.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { razaoSocial: { contains: 'acme', mode: 'insensitive' } },
          { nomeFantasia: { contains: 'acme', mode: 'insensitive' } },
          { cpfCnpj: { contains: 'acme' } },
        ],
      },
      take: 5,
    });
  });

  it('busca produto por nome/codigo/gtin', async () => {
    const prisma = prismaFake({});
    const service = new BuscaService(prisma as never);

    await service.buscar('50010');

    expect(prisma.produto.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { nome: { contains: '50010', mode: 'insensitive' } },
          { codigo: { contains: '50010', mode: 'insensitive' } },
          { gtin: { contains: '50010', mode: 'insensitive' } },
        ],
      },
      take: 5,
    });
  });

  it('busca pedido por numero, incluindo o cliente', async () => {
    const prisma = prismaFake({});
    const service = new BuscaService(prisma as never);

    await service.buscar('1234');

    expect(prisma.pedido.findMany).toHaveBeenCalledWith({
      where: { numero: { contains: '1234', mode: 'insensitive' } },
      take: 5,
      include: { cliente: true },
    });
  });
});
