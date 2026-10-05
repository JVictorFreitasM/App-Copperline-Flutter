import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MensagensPeriodicasService } from './mensagens-periodicas.service';
import type { SalvarMensagemPeriodicaDto } from './dto/salvar-mensagem-periodica.dto';

const AGORA = new Date('2026-10-05T11:00:30.000Z'); // segunda 08:00:30 em SP

function periodicaBruta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    autorId: 'autor-1',
    destino: 'TODOS',
    vendedorId: null,
    grupoId: null,
    assunto: 'Bom dia',
    corpo: 'Vamos vender',
    frequencia: 'DIAS_UTEIS',
    horario: '08:00',
    diaSemana: null,
    diaMes: null,
    ativa: true,
    proximoEnvioEm: new Date('2026-10-05T11:00:00.000Z'),
    ultimoEnvioEm: null,
    ultimoErro: null,
    vendedor: null,
    grupo: null,
    ...overrides,
  };
}

function prismaFake(overrides: {
  devidas?: Record<string, unknown>[];
  existente?: Record<string, unknown> | null;
  reivindicadas?: number;
  vendedor?: unknown;
  grupo?: unknown;
} = {}) {
  return {
    mensagemPeriodica: {
      findMany: jest.fn().mockResolvedValue(overrides.devidas ?? []),
      findUnique: jest
        .fn()
        .mockResolvedValue('existente' in overrides ? overrides.existente : periodicaBruta()),
      updateMany: jest.fn().mockResolvedValue({ count: overrides.reivindicadas ?? 1 }),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        periodicaBruta(data),
      ),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        periodicaBruta(data),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    vendedor: { findUnique: jest.fn().mockResolvedValue('vendedor' in overrides ? overrides.vendedor : { id: 'v1' }) },
    grupoMensagem: { findUnique: jest.fn().mockResolvedValue('grupo' in overrides ? overrides.grupo : { id: 'g1' }) },
  };
}

function mensagensServiceFake(erro?: Error) {
  return {
    enviar: erro
      ? jest.fn().mockRejectedValue(erro)
      : jest.fn().mockResolvedValue({ id: 'm1', totalDestinatarios: 3, semAppVinculado: 0 }),
  };
}

const dtoBase: SalvarMensagemPeriodicaDto = {
  destino: 'TODOS',
  assunto: 'Bom dia',
  mensagem: 'Vamos vender',
  frequencia: 'DIAS_UTEIS',
  horario: '08:00',
};

describe('MensagensPeriodicasService.executarDevidas', () => {
  it('envia a vencida pelo caminho do envio avulso, marcando a origem periodica', async () => {
    const prisma = prismaFake({ devidas: [periodicaBruta()] });
    const mensagens = mensagensServiceFake();
    const service = new MensagensPeriodicasService(prisma as never, mensagens as never);

    const enviadas = await service.executarDevidas(AGORA);

    expect(enviadas).toBe(1);
    expect(mensagens.enviar).toHaveBeenCalledWith(
      'autor-1',
      expect.objectContaining({ destino: 'TODOS', assunto: 'Bom dia', mensagem: 'Vamos vender' }),
      'p1',
    );
    expect(prisma.mensagemPeriodica.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { ultimoEnvioEm: AGORA, ultimoErro: null },
    });
  });

  it('reivindica ANTES de enviar, reagendando a partir de agora (terca 08:00 SP), sem rajada de atrasadas', async () => {
    const prisma = prismaFake({ devidas: [periodicaBruta()] });
    const service = new MensagensPeriodicasService(prisma as never, mensagensServiceFake() as never);

    await service.executarDevidas(AGORA);

    expect(prisma.mensagemPeriodica.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', ativa: true, proximoEnvioEm: new Date('2026-10-05T11:00:00.000Z') },
      data: { proximoEnvioEm: new Date('2026-10-06T11:00:00.000Z') },
    });
  });

  it('se outro worker ja reivindicou (count 0), nao envia - nunca em duplicidade', async () => {
    const prisma = prismaFake({ devidas: [periodicaBruta()], reivindicadas: 0 });
    const mensagens = mensagensServiceFake();
    const service = new MensagensPeriodicasService(prisma as never, mensagens as never);

    const enviadas = await service.executarDevidas(AGORA);

    expect(enviadas).toBe(0);
    expect(mensagens.enviar).not.toHaveBeenCalled();
  });

  it('falha no envio grava o motivo, ja reagendou e segue pra proxima do lote', async () => {
    const prisma = prismaFake({
      devidas: [periodicaBruta({ id: 'p1' }), periodicaBruta({ id: 'p2' })],
    });
    const mensagens = {
      enviar: jest
        .fn()
        .mockRejectedValueOnce(new Error('Nenhum destinatário com o app vinculado'))
        .mockResolvedValueOnce({ id: 'm2', totalDestinatarios: 2, semAppVinculado: 0 }),
    };
    const service = new MensagensPeriodicasService(prisma as never, mensagens as never);

    const enviadas = await service.executarDevidas(AGORA);

    expect(enviadas).toBe(1);
    expect(prisma.mensagemPeriodica.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { ultimoErro: 'Nenhum destinatário com o app vinculado' },
    });
    expect(prisma.mensagemPeriodica.update).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: { ultimoEnvioEm: AGORA, ultimoErro: null },
    });
  });

  it('so busca ativas vencidas', async () => {
    const prisma = prismaFake();
    const service = new MensagensPeriodicasService(prisma as never, mensagensServiceFake() as never);

    await service.executarDevidas(AGORA);

    expect(prisma.mensagemPeriodica.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativa: true, proximoEnvioEm: { lte: AGORA } } }),
    );
  });
});

describe('MensagensPeriodicasService - cadastro', () => {
  it('criar: calcula o proximo envio e grava so os campos da frequencia escolhida', async () => {
    const prisma = prismaFake();
    const service = new MensagensPeriodicasService(prisma as never, mensagensServiceFake() as never);

    await service.criar('autor-1', { ...dtoBase, frequencia: 'DIARIA', diaSemana: 3, diaMes: 9 });

    const { data } = prisma.mensagemPeriodica.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data).toMatchObject({
      autorId: 'autor-1',
      frequencia: 'DIARIA',
      diaSemana: null,
      diaMes: null,
      vendedorId: null,
      grupoId: null,
    });
    expect(data.proximoEnvioEm).toBeInstanceOf(Date);
    expect((data.proximoEnvioEm as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('criar: destino VENDEDOR inexistente -> 404', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new MensagensPeriodicasService(prisma as never, mensagensServiceFake() as never);

    await expect(
      service.criar('autor-1', { ...dtoBase, destino: 'VENDEDOR', vendedorId: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('criar: recorrencia incoerente (SEMANAL sem dia) -> 422', async () => {
    const prisma = prismaFake();
    const service = new MensagensPeriodicasService(prisma as never, mensagensServiceFake() as never);

    await expect(
      service.criar('autor-1', { ...dtoBase, frequencia: 'SEMANAL' }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.mensagemPeriodica.create).not.toHaveBeenCalled();
  });

  it('atualizar: reagenda a partir de agora e limpa o ultimo erro', async () => {
    const prisma = prismaFake();
    const service = new MensagensPeriodicasService(prisma as never, mensagensServiceFake() as never);

    await service.atualizar('p1', dtoBase);

    expect(prisma.mensagemPeriodica.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ ultimoErro: null, proximoEnvioEm: expect.any(Date) }),
      }),
    );
  });

  it('alternar: religar reagenda (nao recupera disparos perdidos); pausar so desliga', async () => {
    const prisma = prismaFake();
    const service = new MensagensPeriodicasService(prisma as never, mensagensServiceFake() as never);

    await service.alternar('p1', true);
    expect(prisma.mensagemPeriodica.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { ativa: true, proximoEnvioEm: expect.any(Date) },
      }),
    );

    await service.alternar('p1', false);
    expect(prisma.mensagemPeriodica.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { ativa: false } }),
    );
  });

  it('atualizar/alternar/remover: inexistente -> 404', async () => {
    const prisma = prismaFake({ existente: null });
    const service = new MensagensPeriodicasService(prisma as never, mensagensServiceFake() as never);

    await expect(service.atualizar('x', dtoBase)).rejects.toThrow(NotFoundException);
    await expect(service.alternar('x', true)).rejects.toThrow(NotFoundException);
    await expect(service.remover('x')).rejects.toThrow(NotFoundException);
  });
});
