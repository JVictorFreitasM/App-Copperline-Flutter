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
