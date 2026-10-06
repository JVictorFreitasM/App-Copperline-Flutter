import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ClienteCadastroService } from './cliente-cadastro.service';
import type { CriarClienteDto } from './dto/criar-cliente.dto';

const CNPJ_VALIDO = '07127994000150';

function dtoBase(sobrescrever: Partial<CriarClienteDto> = {}): CriarClienteDto {
  return {
    cpfCnpj: '07.127.994/0001-50',
    razaoSocial: 'MEGA FIOS LTDA',
    enderecoCobranca: {
      cep: '64076130',
      logradouro: 'AV DEPUTADO PAULO FERRAZ',
      numero: 5250,
      bairro: 'LIVRAMENTO',
      codigoIbge: '2211001',
      uf: 'PI',
    },
    contatos: [{ nome: 'Maria', funcao: 'Compras' }],
    ...sobrescrever,
  };
}

function montar() {
  const tx = {
    cliente: { create: jest.fn().mockResolvedValue({}) },
    contatoCliente: { create: jest.fn().mockResolvedValue({}) },
    clienteVendedor: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    cliente: { findFirst: jest.fn().mockResolvedValue(null) },
    vendedor: {
      findFirst: jest.fn().mockResolvedValue({ id: 'vend-1', idExternoErp: 'vend-ext-1' }),
    },
    $transaction: jest.fn((callback: (t: unknown) => unknown) => callback(tx)),
  };
  const municipioWkService = { idPorCodigoIbge: jest.fn().mockResolvedValue('52002816') };
  const consultaCepService = { consultar: jest.fn().mockResolvedValue({ codigoIbge: '2211001' }) };
  const fila = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new ClienteCadastroService(
    prisma as never,
    municipioWkService as never,
    consultaCepService as never,
    fila as never,
  );
  return { service, prisma, tx, municipioWkService, consultaCepService, fila };
}

const ESCOPO_PROPRIO = { tipo: 'PROPRIO', vendedorId: 'vend-1' } as const;

describe('ClienteCadastroService.criar - validacoes antes de gravar', () => {
  it('documento invalido (DV) e rejeitado sem tocar na base', async () => {
    const m = montar();

    await expect(
      m.service.criar(dtoBase({ cpfCnpj: '07127994000151' }), 'u1', ESCOPO_PROPRIO),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(m.prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('documento ja na base: 409 informando o vendedor responsavel, e nao grava nem enfileira', async () => {
    const m = montar();
    m.prisma.cliente.findFirst.mockResolvedValue({
      vendedores: [{ vendedor: { nome: 'Joana' } }],
    });

    await expect(
      m.service.criar(dtoBase(), 'u1', ESCOPO_PROPRIO),
    ).rejects.toThrow(new ConflictException('Cliente já cadastrado - vendedor responsável: Joana'));

    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.fila.add).not.toHaveBeenCalled();
  });

  it('confere duplicidade pelas duas formas do documento (o sync grava formatado)', async () => {
    const m = montar();

    await m.service.criar(dtoBase({ cpfCnpj: CNPJ_VALIDO }), 'u1', ESCOPO_PROPRIO);

    expect(m.prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cpfCnpj: { in: [CNPJ_VALIDO, '07.127.994/0001-50'] } },
      }),
    );
  });

  it('sem nenhum contato nao cadastra (pelo menos um e obrigatorio)', async () => {
    const m = montar();

    await expect(
      m.service.criar(dtoBase({ contatos: [] }), 'u1', ESCOPO_PROPRIO),
    ).rejects.toThrow(new BadRequestException('Adicione pelo menos um contato'));

    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.fila.add).not.toHaveBeenCalled();
  });

  it('escopo NENHUM nao cadastra', async () => {
    const m = montar();

    await expect(
      m.service.criar(dtoBase(), 'u1', { tipo: 'NENHUM' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('usuario que nao e vendedor (e nao e admin) nao cadastra', async () => {
    const m = montar();
    m.prisma.vendedor.findFirst.mockResolvedValue(null);

    await expect(
      m.service.criar(dtoBase(), 'u1', { tipo: 'EQUIPE', vendedorIds: ['x'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin sem vendedor cadastra, sem vinculo de vendedor', async () => {
    const m = montar();
    m.prisma.vendedor.findFirst.mockResolvedValue(null);

    await m.service.criar(dtoBase(), 'u1', { tipo: 'TODOS' });

    expect(m.tx.clienteVendedor.create).not.toHaveBeenCalled();
    expect(m.tx.cliente.create).toHaveBeenCalledTimes(1);
  });
});

describe('ClienteCadastroService.criar - municipio', () => {
  it('traduz o IBGE enviado pelo front em idMunicipio do Radar', async () => {
    const m = montar();

    await m.service.criar(dtoBase(), 'u1', ESCOPO_PROPRIO);

    expect(m.municipioWkService.idPorCodigoIbge).toHaveBeenCalledWith('2211001');
    expect(m.consultaCepService.consultar).not.toHaveBeenCalled();
  });

  it('sem IBGE no DTO, descobre pelo CEP', async () => {
    const m = montar();
    const dto = dtoBase();
    delete dto.enderecoCobranca.codigoIbge;

    await m.service.criar(dto, 'u1', ESCOPO_PROPRIO);

    expect(m.consultaCepService.consultar).toHaveBeenCalledWith('64076130');
    expect(m.municipioWkService.idPorCodigoIbge).toHaveBeenCalledWith('2211001');
  });

  it('idMunicipio informado direto dispensa qualquer consulta', async () => {
    const m = montar();
    const dto = dtoBase();
    dto.enderecoCobranca.idMunicipio = '999';

    await m.service.criar(dto, 'u1', ESCOPO_PROPRIO);

    expect(m.municipioWkService.idPorCodigoIbge).not.toHaveBeenCalled();
    expect(m.consultaCepService.consultar).not.toHaveBeenCalled();
  });

  it('municipio nao identificado: 400 e nada e gravado', async () => {
    const m = montar();
    m.municipioWkService.idPorCodigoIbge.mockResolvedValue(null);

    await expect(
      m.service.criar(dtoBase(), 'u1', ESCOPO_PROPRIO),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('ClienteCadastroService.criar - persistencia e envio', () => {
  it('grava PENDENTE com id sintetico, codigoIntegrador = id local e payload pronto pro Radar', async () => {
    const m = montar();

    const criado = await m.service.criar(dtoBase({ limiteCredito: 5000 }), 'u1', ESCOPO_PROPRIO);

    const { data } = m.tx.cliente.create.mock.calls[0][0] as {
      data: Record<string, unknown> & { payloadEnvioErp: Record<string, unknown> };
    };
    expect(criado).toEqual({ id: data.id, statusEnvioErp: 'PENDENTE' });
    expect(data).toMatchObject({
      idExternoErp: `PENDENTE-${data.id as string}`,
      codigoIntegrador: data.id,
      cpfCnpj: '07.127.994/0001-50',
      statusEnvioErp: 'PENDENTE',
      criadoLocalmente: true,
      limiteCredito: 5000,
    });
    expect(data.payloadEnvioErp).toMatchObject({
      codigoIntegrador: data.id,
      tipoPessoa: 'Juridica',
      detalhes: { idVendedores: ['vend-ext-1'] },
      informacoesFinanceiras: { limiteCredito: 5000 },
    });
  });

  it('cliente nasce vinculado ao vendedor que cadastrou (senao some da propria carteira)', async () => {
    const m = montar();

    const criado = await m.service.criar(dtoBase(), 'u1', ESCOPO_PROPRIO);

    expect(m.tx.clienteVendedor.create).toHaveBeenCalledWith({
      data: { clienteId: criado.id, vendedorId: 'vend-1' },
    });
  });

  it('telefones do cliente vao no endereco de cobranca (Padrao) e contatos viram contatos locais', async () => {
    const m = montar();

    await m.service.criar(
      dtoBase({
        telefones: [{ ddd: '86', numero: '999998888' }],
        contatos: [{ nome: 'Maria', funcao: 'Compras' }],
      }),
      'u1',
      ESCOPO_PROPRIO,
    );

    const { data } = m.tx.cliente.create.mock.calls[0][0] as {
      data: { payloadEnvioErp: { enderecos: { tipo: string; telefones: unknown[] }[] } };
    };
    expect(data.payloadEnvioErp.enderecos[0]).toMatchObject({
      tipo: 'Padrao',
      telefones: [{ ddd: '86', numero: '999998888' }],
    });
    expect(m.tx.contatoCliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nome: 'Maria',
        funcao: 'Compras',
        criadoLocalmente: true,
        idExternoErp: expect.stringMatching(/^LOCAL-/),
      }),
    });
  });

  it('pino do mapa vira a localizacao do cliente', async () => {
    const m = montar();
    const dto = dtoBase();
    dto.enderecoCobranca.latitude = -5.08;
    dto.enderecoCobranca.longitude = -42.8;

    await m.service.criar(dto, 'u1', ESCOPO_PROPRIO);

    expect(m.tx.cliente.create.mock.calls[0][0]).toMatchObject({
      data: {
        localizacaoLat: -5.08,
        localizacaoLng: -42.8,
        localizacaoDefinidaPorId: 'vend-1',
      },
    });
  });

  it('endereco de entrega e enviado alem do padrao', async () => {
    const m = montar();
    const dto = dtoBase({ enderecoEntrega: { ...dtoBase().enderecoCobranca, cep: '01311902' } });

    await m.service.criar(dto, 'u1', ESCOPO_PROPRIO);

    const { data } = m.tx.cliente.create.mock.calls[0][0] as {
      data: { payloadEnvioErp: { enderecos: { tipo: string }[] } };
    };
    expect(data.payloadEnvioErp.enderecos.map((e) => e.tipo)).toEqual(['Padrao', 'Entrega']);
  });

  it('enfileira o envio com jobId fixo por cliente e tentativas com backoff', async () => {
    const m = montar();

    const criado = await m.service.criar(dtoBase(), 'u1', ESCOPO_PROPRIO);

    expect(m.fila.add).toHaveBeenCalledWith(
      'cliente.enviar-erp',
      { clienteId: criado.id },
      expect.objectContaining({
        jobId: `cliente-${criado.id}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      }),
    );
  });

  it('falha ao enfileirar NAO desfaz o cadastro (fica PENDENTE e o scheduler re-enfileira)', async () => {
    const m = montar();
    m.fila.add.mockRejectedValue(new Error('redis fora'));

    const criado = await m.service.criar(dtoBase(), 'u1', ESCOPO_PROPRIO);

    expect(criado.statusEnvioErp).toBe('PENDENTE');
  });
});
