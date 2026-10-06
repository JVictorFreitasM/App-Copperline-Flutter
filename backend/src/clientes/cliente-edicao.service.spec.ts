import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClienteEdicaoService } from './cliente-edicao.service';
import { EnderecoClienteService } from './endereco-cliente.service';

const PADRAO_BANCO = {
  tipo: 'Padrao',
  cep: '64076-130',
  nomeEndereco: 'AV DEPUTADO PAULO FERRAZ',
  numero: 5250,
  semNumero: false,
  complemento: '',
  bairro: 'LIVRAMENTO',
  idMunicipio: '52002816',
  uf: 'PI',
  codigoIBGE: '2211001',
  telefones: [{ ddd: '86', numero: '32188383' }],
  email: null,
};

function clienteNoRadar(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: 'cli-1',
    idExternoErp: '777',
    cpfCnpj: '07.127.994/0001-50',
    codigo: '10458',
    razaoSocial: 'MEGA FIOS LTDA',
    nomeFantasia: 'MEGA',
    email: 'contato@megafios.com.br',
    inscricaoEstadual: '123',
    limiteCredito: { toNumber: () => 5000 },
    enderecos: [PADRAO_BANCO],
    criadoLocalmente: false,
    payloadEnvioErp: null,
    statusEnvioErp: 'ENVIADO',
    ...sobrescrever,
  };
}

function clienteAindaNaoEnviado(status: 'PENDENTE' | 'ERRO' = 'PENDENTE') {
  return clienteNoRadar({
    idExternoErp: 'PENDENTE-cli-1',
    criadoLocalmente: true,
    statusEnvioErp: status,
    payloadEnvioErp: {
      codigoIntegrador: 'cli-1',
      cpfCnpj: '07.127.994/0001-50',
      tipoPessoa: 'Juridica',
      razaoSocial: 'MEGA FIOS LTDA',
      enderecos: [{ tipo: 'Padrao', cep: '64076130', nomeEndereco: 'AV X', semNumero: true, bairro: 'B', idMunicipio: '52002816', telefones: [] }],
      contatos: [{ nome: 'Maria' }],
    },
  });
}

function montar(cliente: unknown = clienteNoRadar()) {
  const tx = {
    cliente: {
      findFirst: jest.fn().mockResolvedValue(cliente),
      update: jest.fn().mockResolvedValue({}),
    },
    alteracaoClienteErp: { create: jest.fn().mockResolvedValue({ id: 'alt-1' }) },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (transacao: typeof tx) => unknown) => callback(tx)),
  };
  const municipioWkService = {
    idPorCodigoIbge: jest.fn().mockResolvedValue('99999999'),
    nomePorId: jest.fn().mockResolvedValue('Teresina'),
  };
  const consultaCepService = { consultar: jest.fn().mockResolvedValue({ codigoIbge: '2211001' }) };
  const clienteCadastroService = {
    garantirEnvioParado: jest.fn().mockResolvedValue(undefined),
    enfileirarEnvio: jest.fn().mockResolvedValue(undefined),
  };
  const fila = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new ClienteEdicaoService(
    prisma as never,
    new EnderecoClienteService(municipioWkService as never, consultaCepService as never),
    clienteCadastroService as never,
    municipioWkService as never,
    fila as never,
  );
  return { service, prisma, clienteCadastroService, fila, municipioWkService };
}

const ESCOPO = { tipo: 'PROPRIO', vendedorId: 'vend-1' } as const;

describe('ClienteEdicaoService.editar - escopo (IDOR)', () => {
  it('escopo NENHUM: 404 sem nem consultar o banco', async () => {
    const m = montar();

    await expect(m.service.editar('cli-1', {}, 'u1', { tipo: 'NENHUM' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(m.prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('confere a carteira do vendedor NA PROPRIA query', async () => {
    const m = montar();

    await m.service.editar('cli-1', { email: 'novo@x.com' }, 'u1', ESCOPO);

    expect(m.prisma.cliente.findFirst).toHaveBeenCalledWith({
      where: { id: 'cli-1', vendedores: { some: { vendedorId: 'vend-1' } } },
    });
  });

  it('cliente fora da carteira (ou inexistente): 404', async () => {
    const m = montar(null);

    await expect(m.service.editar('cli-1', { email: 'x@x.com' }, 'u1', ESCOPO)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ClienteEdicaoService.editar - cliente que ja esta no Radar', () => {
  it('nada mudou: nao grava nem enfileira nada', async () => {
    const m = montar();

    const resultado = await m.service.editar(
      'cli-1',
      {
        razaoSocial: 'MEGA FIOS LTDA',
        nomeFantasia: 'MEGA',
        email: 'contato@megafios.com.br',
        inscricaoEstadual: '123',
        limiteCredito: 5000,
        telefones: [{ ddd: '86', numero: '32188383' }],
        entregaIgualCobranca: true,
      },
      'u1',
      ESCOPO,
    );

    expect(resultado).toEqual({ id: 'cli-1', situacao: 'SEM_ALTERACAO' });
    expect(m.prisma.cliente.update).not.toHaveBeenCalled();
    expect(m.prisma.alteracaoClienteErp.create).not.toHaveBeenCalled();
    expect(m.fila.add).not.toHaveBeenCalled();
  });

  it('grava so o que mudou no banco, registra a alteracao e enfileira o PATCH', async () => {
    const m = montar();

    const resultado = await m.service.editar(
      'cli-1',
      { email: 'vendas@megafios.com.br', limiteCredito: 8000, razaoSocial: 'MEGA FIOS LTDA' },
      'u1',
      ESCOPO,
    );

    expect(resultado).toEqual({ id: 'cli-1', situacao: 'ALTERACAO_PENDENTE' });
    expect(m.prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cli-1' },
      data: { email: 'vendas@megafios.com.br', limiteCredito: 8000 },
    });
    expect(m.prisma.alteracaoClienteErp.create).toHaveBeenCalledWith({
      data: {
        clienteId: 'cli-1',
        usuarioId: 'u1',
        payload: { email: 'vendas@megafios.com.br', limiteCredito: 8000 },
      },
      select: { id: true },
    });
    expect(m.fila.add).toHaveBeenCalledWith(
      'cliente.atualizar-erp',
      { alteracaoId: 'alt-1' },
      expect.objectContaining({ jobId: 'alteracao-alt-1', attempts: 5 }),
    );
  });

  it('limpar o nome fantasia: banco fica null e a intencao leva ""', async () => {
    const m = montar();

    await m.service.editar('cli-1', { nomeFantasia: '' }, 'u1', ESCOPO);

    expect(m.prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cli-1' },
      data: { nomeFantasia: null },
    });
    expect(m.prisma.alteracaoClienteErp.create.mock.calls[0][0].data.payload).toEqual({ nomeFantasia: '' });
  });

  it('so os telefones mudaram: o endereco de cobranca muda junto (telefone vive no endereco)', async () => {
    const m = montar();
    const telefones = [{ ddd: '86', numero: '32188383' }, { ddd: '86', numero: '999998888' }];

    await m.service.editar('cli-1', { telefones }, 'u1', ESCOPO);

    const payload = m.prisma.alteracaoClienteErp.create.mock.calls[0][0].data.payload;
    expect(payload.enderecos).toEqual([
      expect.objectContaining({ tipo: 'Padrao', telefones, idMunicipio: '52002816' }),
    ]);
    const { data } = m.prisma.cliente.update.mock.calls[0][0];
    expect(data.enderecos).toEqual([{ ...PADRAO_BANCO, telefones }]);
  });

  it('endereco de cobranca novo: resolve o municipio pelo IBGE e entra na intencao', async () => {
    const m = montar();

    await m.service.editar(
      'cli-1',
      {
        enderecoCobranca: {
          cep: '01311902',
          logradouro: 'AVENIDA PAULISTA',
          numero: 37,
          bairro: 'BELA VISTA',
          codigoIbge: '3550308',
          uf: 'SP',
        },
      },
      'u1',
      ESCOPO,
    );

    expect(m.municipioWkService.idPorCodigoIbge).toHaveBeenCalledWith('3550308');
    const payload = m.prisma.alteracaoClienteErp.create.mock.calls[0][0].data.payload;
    expect(payload.enderecos[0]).toMatchObject({
      tipo: 'Padrao',
      logradouro: 'AVENIDA PAULISTA',
      idMunicipio: '99999999',
      telefones: [{ ddd: '86', numero: '32188383' }],
    });
  });

  it('"entrega igual a cobranca" com entrega diferente: a entrega vira copia da cobranca (mantendo os telefones dela)', async () => {
    const entregaBanco = {
      ...PADRAO_BANCO,
      tipo: 'Entrega',
      nomeEndereco: 'RUA DA ENTREGA',
      telefones: [{ ddd: '86', numero: '33334444' }],
    };
    const m = montar(clienteNoRadar({ enderecos: [PADRAO_BANCO, entregaBanco] }));

    await m.service.editar('cli-1', { entregaIgualCobranca: true }, 'u1', ESCOPO);

    const payload = m.prisma.alteracaoClienteErp.create.mock.calls[0][0].data.payload;
    expect(payload.enderecos).toEqual([
      expect.objectContaining({
        tipo: 'Entrega',
        logradouro: 'AV DEPUTADO PAULO FERRAZ',
        telefones: [{ ddd: '86', numero: '33334444' }],
      }),
    ]);
  });

  it('"entrega igual a cobranca" sem endereco de entrega: nao cria entrega no ERP', async () => {
    const m = montar();

    const resultado = await m.service.editar('cli-1', { entregaIgualCobranca: true }, 'u1', ESCOPO);

    expect(resultado.situacao).toBe('SEM_ALTERACAO');
  });

  it('pessoa juridica ignora RG/nascimento/mae', async () => {
    const m = montar();

    const resultado = await m.service.editar('cli-1', { rg: '123', nomeMae: 'Ana' }, 'u1', ESCOPO);

    expect(resultado.situacao).toBe('SEM_ALTERACAO');
  });

  it('pessoa fisica: RG preenchido vira alteracao', async () => {
    const m = montar(clienteNoRadar({ cpfCnpj: '529.982.247-25' }));

    await m.service.editar('cli-1', { rg: '1234567', nomeMae: '' }, 'u1', ESCOPO);

    expect(m.prisma.alteracaoClienteErp.create.mock.calls[0][0].data.payload).toEqual({ rg: '1234567' });
  });
});

describe('ClienteEdicaoService.editar - cliente que ainda nao chegou ao Radar', () => {
  it('cadastro pendente: reescreve o cadastro que vai ser enviado e reenfileira (sem PATCH)', async () => {
    const m = montar(clienteAindaNaoEnviado('PENDENTE'));

    const resultado = await m.service.editar('cli-1', { razaoSocial: 'MEGA FIOS S.A.' }, 'u1', ESCOPO);

    expect(resultado).toEqual({ id: 'cli-1', situacao: 'CADASTRO_PENDENTE' });
    expect(m.clienteCadastroService.garantirEnvioParado).toHaveBeenCalledWith('cli-1');
    expect(m.prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cli-1' },
      data: expect.objectContaining({
        razaoSocial: 'MEGA FIOS S.A.',
        statusEnvioErp: 'PENDENTE',
        erroEnvioErp: null,
        payloadEnvioErp: expect.objectContaining({
          razaoSocial: 'MEGA FIOS S.A.',
          contatos: [{ nome: 'Maria' }],
        }),
      }),
    });
    expect(m.clienteCadastroService.enfileirarEnvio).toHaveBeenCalledWith('cli-1');
    expect(m.prisma.alteracaoClienteErp.create).not.toHaveBeenCalled();
  });

  it('cadastro recusado pelo ERP (ERRO): a edicao corrige e manda de novo', async () => {
    const m = montar(clienteAindaNaoEnviado('ERRO'));

    const resultado = await m.service.editar('cli-1', { inscricaoEstadual: '999' }, 'u1', ESCOPO);

    expect(resultado.situacao).toBe('CADASTRO_PENDENTE');
    expect(m.prisma.cliente.update.mock.calls[0][0].data).toMatchObject({
      statusEnvioErp: 'PENDENTE',
      erroEnvioErp: null,
      payloadEnvioErp: expect.objectContaining({ inscricoesLegais: { inscricaoEstadual: '999' } }),
    });
    expect(m.clienteCadastroService.enfileirarEnvio).toHaveBeenCalledWith('cli-1');
  });

  it('envio do cadastro em andamento agora: 409 e nada e gravado', async () => {
    const m = montar(clienteAindaNaoEnviado('PENDENTE'));
    m.clienteCadastroService.garantirEnvioParado.mockRejectedValue(new ConflictException('enviando'));

    await expect(
      m.service.editar('cli-1', { razaoSocial: 'OUTRA' }, 'u1', ESCOPO),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(m.prisma.cliente.update).not.toHaveBeenCalled();
    expect(m.clienteCadastroService.enfileirarEnvio).not.toHaveBeenCalled();
  });
});

describe('ClienteEdicaoService.obterParaEdicao', () => {
  it('monta o formulario: endereco com cidade (pelo municipio do Radar), telefones e "entrega igual"', async () => {
    const m = montar();

    const dto = await m.service.obterParaEdicao('cli-1', ESCOPO);

    expect(dto).toMatchObject({
      id: 'cli-1',
      tipoPessoa: 'Juridica',
      codigo: '10458',
      limiteCredito: 5000,
      camposPessoaFisicaConhecidos: false,
      entregaIgualCobranca: true,
      telefones: [{ ddd: '86', numero: '32188383' }],
      enderecoEntrega: null,
      enderecoCobranca: {
        cep: '64076130',
        logradouro: 'AV DEPUTADO PAULO FERRAZ',
        numero: '5250',
        semNumero: false,
        bairro: 'LIVRAMENTO',
        cidade: 'Teresina',
        uf: 'PI',
        codigoIbge: '2211001',
        idMunicipio: '52002816',
      },
    });
  });

  it('entrega diferente da cobranca: "entrega igual" desmarcado', async () => {
    const m = montar(
      clienteNoRadar({
        enderecos: [PADRAO_BANCO, { ...PADRAO_BANCO, tipo: 'Entrega', nomeEndereco: 'OUTRA RUA' }],
      }),
    );

    const dto = await m.service.obterParaEdicao('cli-1', ESCOPO);

    expect(dto.entregaIgualCobranca).toBe(false);
    expect(dto.enderecoEntrega?.logradouro).toBe('OUTRA RUA');
  });

  it('cliente cadastrado por nos: campos de pessoa fisica conhecidos (vem do cadastro)', async () => {
    const cliente = clienteAindaNaoEnviado();
    (cliente.payloadEnvioErp as unknown as Record<string, unknown>).informacoesCadastrais = { rg: '1', nomeMae: 'Ana' };
    const m = montar(cliente);

    const dto = await m.service.obterParaEdicao('cli-1', ESCOPO);

    expect(dto).toMatchObject({ camposPessoaFisicaConhecidos: true, rg: '1', nomeMae: 'Ana' });
  });
});
