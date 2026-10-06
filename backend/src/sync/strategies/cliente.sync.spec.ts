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
      codigo: null,
      codigoIntegrador: null,
      email: null,
      contato: null,
      homepage: null,
      cpfCnpj: '12345678900',
      razaoSocial: 'Cliente Teste Ltda',
      nomeFantasia: null,
      inscricaoEstadual: null,
      inativo: false,
      enderecos: [{ cep: '01000-000', bairro: 'Centro' }],
      contatos: [],
      vendedoresExternoIds: [],
      limiteCredito: null,
      dataLimiteCredito: null,
      tabelaPrecoIdExterno: null,
    });
  });

  // Achado 2026-09-17 - tabela de preco NATIVA do cadastro do cliente,
  // schema real confirmado pelo usuario (informacoesExtras2).
  it('mapeia codigo/email/contato/homepage do cadastro e trata string vazia como null', () => {
    const mapeado = strategy.map({
      id: '17104896',
      codigo: '10458',
      email: 'contato@swan.com.br',
      contato: '',
      homepage: '',
      inativo: false,
    });

    expect(mapeado.codigo).toBe('10458');
    expect(mapeado.email).toBe('contato@swan.com.br');
    expect(mapeado.contato).toBeNull();
    expect(mapeado.homepage).toBeNull();
  });

  it('transforma telefones do endereco em contatos, sem duplicar telefone que ja e contato do Radar', () => {
    const mapeado = strategy.map({
      id: '17104896',
      nomeFantasia: 'SWAN',
      inativo: false,
      enderecos: [
        {
          email: 'mccswan@terra.com.br',
          telefones: [
            { ddd: '086', numero: '999886470' },
            { ddd: '086', numero: '999346426' },
            { ddd: '086', numero: '999346426' },
            { ddd: '086', numero: '' },
          ],
        },
      ],
      contatos: [
        { id: 'c1', nome: 'Maria', telefoneDDD: '86', telefoneNumero: '99988-6470' },
      ],
    });

    expect(mapeado.contatos.map((c) => c.idExternoErp)).toEqual([
      'c1',
      'ENDERECO-17104896-86999346426',
    ]);
    expect(mapeado.contatos[1]).toEqual({
      idExternoErp: 'ENDERECO-17104896-86999346426',
      codigoIntegrador: null,
      nome: 'SWAN - (086) 999346426',
      email: 'mccswan@terra.com.br',
      telefoneDdd: '086',
      telefoneNumero: '999346426',
      funcao: 'Telefone do endereço',
    });
  });

  it('mapeia informacoesExtras2.idTabelaPrecoProduto', () => {
    const bruto: WkRadarCliente = {
      id: '123',
      inativo: false,
      informacoesExtras2: { idTabelaPrecoProduto: 'tabela-ext-110' },
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.tabelaPrecoIdExterno).toBe('tabela-ext-110');
  });

  // Achado 2026-09-28 - confirmado contra a API real do WK Radar (bloco
  // "IE" do PDF de impressao do pedido, ver PedidoPdfService).
  it('mapeia inscricoesLegais.inscricaoEstadual', () => {
    const bruto: WkRadarCliente = {
      id: '123',
      inativo: false,
      inscricoesLegais: { inscricaoEstadual: '195652886' },
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.inscricaoEstadual).toBe('195652886');
  });

  it('mapeia informacoesFinanceiras.limiteCredito/dataLimiteCredito (OS-BACKEND-36)', () => {
    const bruto: WkRadarCliente = {
      id: '123',
      inativo: false,
      informacoesFinanceiras: { limiteCredito: 600, dataLimiteCredito: '2026-08-01' },
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.limiteCredito).toBe(600);
    expect(mapeado.dataLimiteCredito).toEqual(new Date('2026-08-01'));
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

function prismaFake(
  vendedorExistente: { id: string; incompleto: boolean } | null,
  clienteCriadoLocalmente = false,
) {
  const tx = {
    cliente: {
      upsert: jest.fn().mockImplementation(({ create }) => ({
        id: 'cliente-1',
        ...create,
        criadoLocalmente: clienteCriadoLocalmente,
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    contatoCliente: {
      upsert: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
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
  codigo: null,
  codigoIntegrador: null,
  email: null,
  contato: null,
  homepage: null,
  cpfCnpj: null,
  razaoSocial: null,
  nomeFantasia: null,
  inscricaoEstadual: null,
  inativo: false,
  enderecos: [],
  contatos: [],
  vendedoresExternoIds: [] as string[],
  limiteCredito: null as number | null,
  dataLimiteCredito: null as Date | null,
  tabelaPrecoIdExterno: null as string | null,
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

describe('ClienteSyncStrategy.upsert - reconciliacao do cliente criado por nos (POST /clientes)', () => {
  const configServiceFake = { get: () => undefined } as never;
  const strategy = (prisma: ReturnType<typeof prismaFake>) =>
    new ClienteSyncStrategy(undefined as never, prisma as never, configServiceFake);

  it('troca o id sintetico PENDENTE-<uuid> pelo id real ANTES do upsert (senao duplicaria o cliente)', async () => {
    const prisma = prismaFake({ id: 'v1', incompleto: false });
    const ordem: string[] = [];
    prisma.tx.cliente.updateMany.mockImplementation(async () => {
      ordem.push('reconcilia');
      return { count: 1 };
    });
    prisma.tx.cliente.upsert.mockImplementation(async ({ create }) => {
      ordem.push('upsert');
      return { id: 'cliente-1', ...create };
    });

    await strategy(prisma).upsert({ ...MAPEADO_BASE, codigoIntegrador: 'cliente-local-1' });

    expect(prisma.tx.cliente.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'cliente-local-1',
        criadoLocalmente: true,
        idExternoErp: { startsWith: 'PENDENTE-' },
      },
      data: { idExternoErp: '123' },
    });
    expect(ordem[0]).toBe('reconcilia');
    expect(ordem[1]).toBe('upsert');
  });

  it('sem codigoIntegrador nao tenta reconciliar', async () => {
    const prisma = prismaFake({ id: 'v1', incompleto: false });

    await strategy(prisma).upsert({ ...MAPEADO_BASE, codigoIntegrador: null });

    expect(prisma.tx.cliente.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ idExternoErp: { startsWith: 'PENDENTE-' } }),
      }),
    );
  });

  it('cliente criado por nos que chegou do Radar vira ENVIADO', async () => {
    const prisma = prismaFake({ id: 'v1', incompleto: false }, true);

    await strategy(prisma).upsert({ ...MAPEADO_BASE });

    expect(prisma.tx.cliente.updateMany).toHaveBeenCalledWith({
      where: { id: 'cliente-1', criadoLocalmente: true },
      data: { statusEnvioErp: 'ENVIADO', erroEnvioErp: null },
    });
  });

  it('remove contatos locais (sem pedido) quando o Radar devolve os contatos do cliente criado por nos', async () => {
    const prisma = prismaFake({ id: 'v1', incompleto: false }, true);
    const contato = {
      idExternoErp: 'c-1',
      codigoIntegrador: null,
      nome: 'Maria',
      email: null,
      telefoneDdd: null,
      telefoneNumero: null,
      funcao: null,
    };

    await strategy(prisma).upsert({ ...MAPEADO_BASE, contatos: [contato] });

    expect(prisma.tx.contatoCliente.deleteMany).toHaveBeenCalledWith({
      where: { clienteId: 'cliente-1', criadoLocalmente: true, pedidos: { none: {} } },
    });
  });

  it('cliente que nao foi criado por nos nunca tem contatos apagados', async () => {
    const prisma = prismaFake({ id: 'v1', incompleto: false }, false);
    const contato = {
      idExternoErp: 'c-1',
      codigoIntegrador: null,
      nome: 'Maria',
      email: null,
      telefoneDdd: null,
      telefoneNumero: null,
      funcao: null,
    };

    await strategy(prisma).upsert({ ...MAPEADO_BASE, contatos: [contato] });

    expect(prisma.tx.contatoCliente.deleteMany).not.toHaveBeenCalled();
  });
});
