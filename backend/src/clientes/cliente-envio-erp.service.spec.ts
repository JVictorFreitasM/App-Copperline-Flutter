import { AxiosError, type AxiosResponse } from 'axios';
import { UnrecoverableError } from 'bullmq';
import {
  ClienteEnvioErpService,
  extrairIdCriado,
} from './cliente-envio-erp.service';

const PAYLOAD = { codigoIntegrador: 'cli-1', razaoSocial: 'MEGA' };

function erroHttp(status: number, data: unknown = { message: 'recusado' }): AxiosError {
  const erro = new AxiosError('falhou');
  erro.response = { status, data } as AxiosResponse;
  return erro;
}

function montar(opcoes: { habilitado?: boolean; cliente?: unknown } = {}) {
  const prisma = {
    cliente: {
      findUnique: jest.fn(async (args: { where: { id?: string; idExternoErp?: string } }) => {
        if (args.where.idExternoErp) return null;
        return opcoes.cliente === undefined
          ? { statusEnvioErp: 'PENDENTE', payloadEnvioErp: PAYLOAD }
          : opcoes.cliente;
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const erpClient = { post: jest.fn().mockResolvedValue([{ id: 'ext-99' }]) };
  const configService = {
    get: (chave: string) =>
      chave === 'CLIENTE_ENVIO_ERP_HABILITADO' && opcoes.habilitado !== false ? 'true' : undefined,
  };
  const service = new ClienteEnvioErpService(
    prisma as never,
    erpClient as never,
    configService as never,
  );
  return { service, prisma, erpClient };
}

describe('ClienteEnvioErpService.enviar', () => {
  it('desligado por padrao: nao chama o ERP e nao muda o cliente', async () => {
    const m = montar({ habilitado: false });

    expect(await m.service.enviar('cli-1', false)).toBe('DESABILITADO');

    expect(m.erpClient.post).not.toHaveBeenCalled();
    expect(m.prisma.cliente.update).not.toHaveBeenCalled();
  });

  it('envia o payload gravado dentro de um ARRAY e marca ENVIADO trocando pelo id real', async () => {
    const m = montar();

    expect(await m.service.enviar('cli-1', false)).toBe('ENVIADO');

    expect(m.erpClient.post).toHaveBeenCalledWith('/empresarial/v1/cliente', [PAYLOAD]);
    expect(m.prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cli-1' },
      data: { statusEnvioErp: 'ENVIADO', erroEnvioErp: null, idExternoErp: 'ext-99' },
    });
  });

  it('resposta sem id reconhecivel: marca ENVIADO e deixa o sync reconciliar', async () => {
    const m = montar();
    m.erpClient.post.mockResolvedValue({ ok: true });

    await m.service.enviar('cli-1', false);

    expect(m.prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cli-1' },
      data: { statusEnvioErp: 'ENVIADO', erroEnvioErp: null },
    });
  });

  it('cliente ja ENVIADO ou inexistente e ignorado (sem POST)', async () => {
    const enviado = montar({ cliente: { statusEnvioErp: 'ENVIADO', payloadEnvioErp: PAYLOAD } });
    const inexistente = montar({ cliente: null });

    expect(await enviado.service.enviar('cli-1', false)).toBe('IGNORADO');
    expect(await inexistente.service.enviar('cli-1', false)).toBe('IGNORADO');
    expect(enviado.erpClient.post).not.toHaveBeenCalled();
    expect(inexistente.erpClient.post).not.toHaveBeenCalled();
  });

  it('recusa do ERP (4xx): marca ERRO com a mensagem e NAO tenta de novo (UnrecoverableError)', async () => {
    const m = montar();
    m.erpClient.post.mockRejectedValue(erroHttp(400, { message: 'CNPJ ja cadastrado' }));

    await expect(m.service.enviar('cli-1', false)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(m.prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cli-1' },
      data: {
        statusEnvioErp: 'ERRO',
        erroEnvioErp: JSON.stringify({ message: 'CNPJ ja cadastrado' }),
      },
    });
  });

  it('erro transitorio (5xx/429/rede) NAO marca ERRO enquanto ha tentativas, e propaga pra o job repetir', async () => {
    for (const erro of [erroHttp(503), erroHttp(429), new Error('ECONNRESET')]) {
      const m = montar();
      m.erpClient.post.mockRejectedValue(erro);

      await expect(m.service.enviar('cli-1', false)).rejects.toBe(erro);
      expect(m.prisma.cliente.update).not.toHaveBeenCalled();
    }
  });

  it('erro transitorio na ULTIMA tentativa marca ERRO', async () => {
    const m = montar();
    m.erpClient.post.mockRejectedValue(erroHttp(503, 'indisponivel'));

    await expect(m.service.enviar('cli-1', true)).rejects.toBeDefined();

    expect(m.prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cli-1' },
      data: { statusEnvioErp: 'ERRO', erroEnvioErp: 'indisponivel' },
    });
  });
});

describe('extrairIdCriado', () => {
  it('le o id de objeto, array de objetos ou lista de ids', () => {
    expect(extrairIdCriado({ id: 'a' })).toBe('a');
    expect(extrairIdCriado([{ id: 'b' }])).toBe('b');
    expect(extrairIdCriado(['c'])).toBe('c');
  });

  it('devolve null quando nao reconhece', () => {
    expect(extrairIdCriado(null)).toBeNull();
    expect(extrairIdCriado({})).toBeNull();
    expect(extrairIdCriado([])).toBeNull();
    expect(extrairIdCriado({ id: 5 })).toBeNull();
  });
});

describe('ClienteEnvioErpService.enviarAlteracao (PATCH de cliente ja no Radar)', () => {
  const CRIADO_EM = new Date('2026-10-06T12:00:00Z');
  const RADAR_ATUAL = {
    inscricoesLegais: { tipoICMS: 'Contribuinte', inscricaoEstadual: '123', cnaePrincipal: '2733300' },
    enderecos: [],
  };

  function montarAlteracao(
    opcoes: {
      habilitado?: boolean;
      alteracao?: unknown;
      anterior?: unknown;
    } = {},
  ) {
    const prisma = {
      alteracaoClienteErp: {
        findUnique: jest.fn().mockResolvedValue(
          opcoes.alteracao === undefined
            ? {
                clienteId: 'cli-1',
                status: 'PENDENTE',
                payload: { inscricaoEstadual: '999', email: 'novo@x.com' },
                criadoEm: CRIADO_EM,
                cliente: { idExternoErp: '777' },
              }
            : opcoes.alteracao,
        ),
        findFirst: jest.fn().mockResolvedValue(opcoes.anterior ?? null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const erpClient = {
      get: jest.fn().mockResolvedValue(RADAR_ATUAL),
      patch: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: (chave: string) =>
        chave === 'CLIENTE_ENVIO_ERP_HABILITADO' && opcoes.habilitado !== false ? 'true' : undefined,
    };
    const service = new ClienteEnvioErpService(prisma as never, erpClient as never, configService as never);
    return { service, prisma, erpClient };
  }

  it('desligado: nao le nem escreve no ERP', async () => {
    const m = montarAlteracao({ habilitado: false });

    expect(await m.service.enviarAlteracao('alt-1', false)).toBe('DESABILITADO');
    expect(m.erpClient.get).not.toHaveBeenCalled();
    expect(m.erpClient.patch).not.toHaveBeenCalled();
  });

  it('le o cliente atual no Radar e manda o PATCH com o bloco completo; marca ENVIADO', async () => {
    const m = montarAlteracao();

    expect(await m.service.enviarAlteracao('alt-1', false)).toBe('ENVIADO');

    expect(m.erpClient.get).toHaveBeenCalledWith('/empresarial/v1/cliente/777');
    expect(m.erpClient.patch).toHaveBeenCalledWith('/empresarial/v1/cliente/777', {
      email: 'novo@x.com',
      inscricoesLegais: { tipoICMS: 'Contribuinte', inscricaoEstadual: '999', cnaePrincipal: '2733300' },
    });
    expect(m.prisma.alteracaoClienteErp.update).toHaveBeenCalledWith({
      where: { id: 'alt-1' },
      data: { status: 'ENVIADO', erro: null, enviadoEm: expect.any(Date) },
    });
  });

  it('GET que devolve lista: usa o primeiro', async () => {
    const m = montarAlteracao();
    m.erpClient.get.mockResolvedValue([RADAR_ATUAL]);

    expect(await m.service.enviarAlteracao('alt-1', false)).toBe('ENVIADO');
  });

  it('alteracao anterior do mesmo cliente ainda pendente: espera (erro pra repetir), sem tocar no ERP', async () => {
    const m = montarAlteracao({ anterior: { id: 'alt-0' } });

    await expect(m.service.enviarAlteracao('alt-1', false)).rejects.toThrow('Aguardando');
    expect(m.prisma.alteracaoClienteErp.findFirst).toHaveBeenCalledWith({
      where: { clienteId: 'cli-1', status: 'PENDENTE', criadoEm: { lt: CRIADO_EM } },
      select: { id: true },
    });
    expect(m.erpClient.get).not.toHaveBeenCalled();
  });

  it('esperando a anterior na ULTIMA tentativa: adia (fica PENDENTE, nao vira ERRO)', async () => {
    const m = montarAlteracao({ anterior: { id: 'alt-0' } });

    expect(await m.service.enviarAlteracao('alt-1', true)).toBe('ADIADO');
    expect(m.prisma.alteracaoClienteErp.update).not.toHaveBeenCalled();
  });

  it('recusa do ERP (4xx no PATCH): ERRO com a mensagem e sem repetir', async () => {
    const m = montarAlteracao();
    m.erpClient.patch.mockRejectedValue(erroHttp(400, { message: 'IE invalida' }));

    await expect(m.service.enviarAlteracao('alt-1', false)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(m.prisma.alteracaoClienteErp.update).toHaveBeenCalledWith({
      where: { id: 'alt-1' },
      data: { status: 'ERRO', erro: JSON.stringify({ message: 'IE invalida' }) },
    });
  });

  it('erro transitorio: repete; na ultima tentativa marca ERRO', async () => {
    const m = montarAlteracao();
    m.erpClient.get.mockRejectedValue(erroHttp(503, 'fora'));

    await expect(m.service.enviarAlteracao('alt-1', false)).rejects.toBeDefined();
    expect(m.prisma.alteracaoClienteErp.update).not.toHaveBeenCalled();

    await expect(m.service.enviarAlteracao('alt-1', true)).rejects.toBeDefined();
    expect(m.prisma.alteracaoClienteErp.update).toHaveBeenCalledWith({
      where: { id: 'alt-1' },
      data: { status: 'ERRO', erro: 'fora' },
    });
  });

  it('alteracao ja enviada (ou inexistente) e ignorada', async () => {
    const enviada = montarAlteracao({ alteracao: { status: 'ENVIADO' } });
    const inexistente = montarAlteracao({ alteracao: null });

    expect(await enviada.service.enviarAlteracao('alt-1', false)).toBe('IGNORADO');
    expect(await inexistente.service.enviarAlteracao('alt-1', false)).toBe('IGNORADO');
    expect(enviada.erpClient.patch).not.toHaveBeenCalled();
  });

  it('cliente que ainda nao existe no Radar: ERRO explicito, sem chamar o ERP', async () => {
    const m = montarAlteracao({
      alteracao: {
        clienteId: 'cli-1',
        status: 'PENDENTE',
        payload: {},
        criadoEm: CRIADO_EM,
        cliente: { idExternoErp: 'PENDENTE-cli-1' },
      },
    });

    expect(await m.service.enviarAlteracao('alt-1', false)).toBe('IGNORADO');
    expect(m.prisma.alteracaoClienteErp.update).toHaveBeenCalledWith({
      where: { id: 'alt-1' },
      data: { status: 'ERRO', erro: 'Cliente ainda não existe no ERP' },
    });
    expect(m.erpClient.get).not.toHaveBeenCalled();
  });
});
