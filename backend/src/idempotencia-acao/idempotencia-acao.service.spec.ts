import { IdempotenciaAcaoService } from './idempotencia-acao.service';

function violacaoUnicidade() {
  return Object.assign(new Error('Unique constraint'), { code: 'P2002' });
}

function montar(existente?: Record<string, unknown>) {
  const prisma = {
    acaoFilaProcessada: {
      create: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(existente ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  return { prisma, service: new IdempotenciaAcaoService(prisma as never) };
}

describe('IdempotenciaAcaoService.reservar', () => {
  it('primeira requisicao ganha a reserva (cria PROCESSANDO antes de executar)', async () => {
    const { prisma, service } = montar();
    prisma.acaoFilaProcessada.create.mockResolvedValue({ id: 'r1' });

    const reserva = await service.reservar('u1', 'acao-1', 'CRIAR_PEDIDO', 'h1');

    expect(reserva).toEqual({ situacao: 'nova', registroId: 'r1' });
    expect(prisma.acaoFilaProcessada.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 'u1',
        idLocal: 'acao-1',
        tipo: 'CRIAR_PEDIDO',
        status: 'PROCESSANDO',
        payloadHash: 'h1',
      },
    });
  });

  it('segunda requisicao concorrente (reserva ainda PROCESSANDO e recente) NAO executa', async () => {
    const { prisma, service } = montar({ id: 'r1', status: 'PROCESSANDO', payloadHash: 'h1' });
    prisma.acaoFilaProcessada.create.mockRejectedValue(violacaoUnicidade());

    const reserva = await service.reservar('u1', 'acao-1', 'CRIAR_PEDIDO', 'h1');

    expect(reserva).toEqual({ situacao: 'em-processamento' });
  });

  it('reserva abandonada (PROCESSANDO antiga) e retomada por quem a pegar primeiro', async () => {
    const { prisma, service } = montar({ id: 'r1', status: 'PROCESSANDO', payloadHash: 'h1' });
    prisma.acaoFilaProcessada.create.mockRejectedValue(violacaoUnicidade());
    prisma.acaoFilaProcessada.updateMany.mockResolvedValue({ count: 1 });

    const reserva = await service.reservar('u1', 'acao-1', 'CRIAR_PEDIDO', 'h1');

    expect(reserva).toEqual({ situacao: 'nova', registroId: 'r1' });
  });

  it('acao ja concluida devolve o resultado congelado', async () => {
    const { prisma, service } = montar({
      id: 'r1',
      status: 'SUCESSO',
      resultado: { pedidoId: 'p1' },
      erro: null,
      payloadHash: 'h1',
    });
    prisma.acaoFilaProcessada.create.mockRejectedValue(violacaoUnicidade());

    const reserva = await service.reservar('u1', 'acao-1', 'CRIAR_PEDIDO', 'h1');

    expect(reserva).toEqual({
      situacao: 'concluida',
      status: 'SUCESSO',
      resultado: { pedidoId: 'p1' },
      erro: undefined,
      payloadHash: 'h1',
    });
  });

  it('mesmo idLocal com hash diferente e conflito', async () => {
    const { prisma, service } = montar({ id: 'r1', status: 'SUCESSO', payloadHash: 'h-antigo' });
    prisma.acaoFilaProcessada.create.mockRejectedValue(violacaoUnicidade());

    expect(await service.reservar('u1', 'acao-1', 'CRIAR_PEDIDO', 'h-novo')).toEqual({
      situacao: 'conflito',
    });
  });

  it('reserva feita sem hash (POST direto) nao da conflito com o reenvio pela fila', async () => {
    const { prisma, service } = montar({
      id: 'r1',
      status: 'SUCESSO',
      resultado: { pedidoId: 'p1' },
      payloadHash: null,
    });
    prisma.acaoFilaProcessada.create.mockRejectedValue(violacaoUnicidade());

    const reserva = await service.reservar('u1', 'acao-1', 'CRIAR_PEDIDO', 'h-fila');

    expect(reserva).toMatchObject({ situacao: 'concluida', status: 'SUCESSO' });
  });

  it('erro que nao e violacao de unicidade propaga', async () => {
    const { prisma, service } = montar();
    prisma.acaoFilaProcessada.create.mockRejectedValue(new Error('banco fora'));

    await expect(service.reservar('u1', 'acao-1', 'CRIAR_PEDIDO', null)).rejects.toThrow(
      'banco fora',
    );
  });
});

describe('IdempotenciaAcaoService.concluir', () => {
  it('grava status e resultado congelados no registro reservado', async () => {
    const { prisma, service } = montar();

    await service.concluir('r1', 'SUCESSO', { pedidoId: 'p1' });

    expect(prisma.acaoFilaProcessada.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ status: 'SUCESSO', resultado: { pedidoId: 'p1' } }),
    });
  });
});
