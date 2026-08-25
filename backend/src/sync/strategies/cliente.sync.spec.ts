import { ClienteSyncStrategy } from './cliente.sync';
import type { WkRadarCliente } from './cliente.types';

describe('ClienteSyncStrategy.map', () => {
  const configServiceFake = { get: () => undefined } as never;
  const strategy = new ClienteSyncStrategy(
    undefined as never,
    undefined as never,
    configServiceFake,
  );

  it('mapeia os campos-chave e usa null para ausentes, sem lancar em campos opcionais', () => {
    const bruto: WkRadarCliente = {
      id: '123',
      codigoIntegrador: null,
      cpfCnpj: '12345678900',
      razaoSocial: 'Cliente Teste Ltda',
      nomeFantasia: null,
      inativo: false,
      enderecos: [{ cep: '01000-000', bairro: 'Centro' }],
      contatos: null,
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado).toEqual({
      idExternoErp: '123',
      codigoIntegrador: null,
      cpfCnpj: '12345678900',
      razaoSocial: 'Cliente Teste Ltda',
      nomeFantasia: null,
      inativo: false,
      enderecos: [{ cep: '01000-000', bairro: 'Centro' }],
      contatos: [],
      vendedoresExternoIds: [],
    });
  });

  it('mapeia detalhes.idVendedores (array - cliente pode ter mais de um vendedor)', () => {
    const bruto: WkRadarCliente = {
      id: '123',
      inativo: false,
      detalhes: { idVendedores: ['v1', 'v2'] },
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.vendedoresExternoIds).toEqual(['v1', 'v2']);
  });

  it('mapeia contatos aninhados, preservando o id externo de cada um', () => {
    const bruto: WkRadarCliente = {
      id: '123',
      inativo: false,
      contatos: [
        {
          id: 'c1',
          codigoIntegrador: 'INT-1',
          nome: 'Fulano',
          email: 'fulano@example.com',
          funcao: 'Comprador',
          telefoneDDD: '11',
          telefoneNumero: '999999999',
        },
      ],
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.contatos).toEqual([
      {
        idExternoErp: 'c1',
        codigoIntegrador: 'INT-1',
        nome: 'Fulano',
        email: 'fulano@example.com',
        telefoneDdd: '11',
        telefoneNumero: '999999999',
        funcao: 'Comprador',
      },
    ]);
  });
});

function prismaFake(vendedorExistente: { id: string; incompleto: boolean } | null) {
  const tx = {
    cliente: {
      upsert: jest.fn().mockImplementation(({ create }) => ({ id: 'cliente-1', ...create })),
    },
    contatoCliente: { upsert: jest.fn().mockResolvedValue(undefined) },
    clienteVendedor: {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    },
    vendedor: {
      upsert: jest.fn().mockImplementation(({ create }) =>
        vendedorExistente ?? { id: 'vendedor-stub-1', ...create },
      ),
    },
  };
  return {
    tx,
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
  };
}

const MAPEADO_BASE = {
  idExternoErp: '123',
  codigoIntegrador: null,
  cpfCnpj: null,
  razaoSocial: null,
  nomeFantasia: null,
  inativo: false,
  enderecos: [],
  contatos: [],
  vendedoresExternoIds: [] as string[],
};

describe('ClienteSyncStrategy.upsert (OS-BACKEND-23, vinculo N:N com vendedor)', () => {
  const configServiceFake = { get: () => undefined } as never;

  it('recria os vinculos ClienteVendedor a cada sync (delete + create)', async () => {
    const prisma = prismaFake({ id: 'vendedor-1', incompleto: false });
    const strategy = new ClienteSyncStrategy(
      undefined as never,
      prisma as never,
      configServiceFake,
    );

    await strategy.upsert({ ...MAPEADO_BASE, vendedoresExternoIds: ['v-ext-1'] });

    expect(prisma.tx.clienteVendedor.deleteMany).toHaveBeenCalledWith({
      where: { clienteId: 'cliente-1' },
    });
    expect(prisma.tx.clienteVendedor.create).toHaveBeenCalledWith({
      data: { clienteId: 'cliente-1', vendedorId: 'vendedor-1' },
    });
  });

  it('cria um stub de Vendedor (incompleto:true) quando o vendedor referenciado ainda nao foi sincronizado', async () => {
    const prisma = prismaFake(null);
    const strategy = new ClienteSyncStrategy(
      undefined as never,
      prisma as never,
      configServiceFake,
    );

    await strategy.upsert({ ...MAPEADO_BASE, vendedoresExternoIds: ['v-ext-novo'] });

    expect(prisma.tx.vendedor.upsert).toHaveBeenCalledWith({
      where: { idExternoErp: 'v-ext-novo' },
      update: {},
      create: { idExternoErp: 'v-ext-novo', incompleto: true, sincronizadoEm: expect.any(Date) },
    });
    expect(prisma.tx.clienteVendedor.create).toHaveBeenCalledWith({
      data: { clienteId: 'cliente-1', vendedorId: 'vendedor-stub-1' },
    });
  });

  it('nao cria nenhum vinculo quando vendedoresExternoIds esta vazio', async () => {
    const prisma = prismaFake(null);
    const strategy = new ClienteSyncStrategy(
      undefined as never,
      prisma as never,
      configServiceFake,
    );

    await strategy.upsert({ ...MAPEADO_BASE, vendedoresExternoIds: [] });

    expect(prisma.tx.clienteVendedor.create).not.toHaveBeenCalled();
  });
});
