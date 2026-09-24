import { NotFoundException } from '@nestjs/common';
import { NotificacaoUsuarioService } from './notificacao-usuario.service';

function notificacaoBruta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    lida: false,
    lidaEm: null,
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    evento: {
      tipo: 'PEDIDO_SITUACAO_ALTERADA',
      titulo: 'Título',
      corpo: 'Corpo',
      dados: { pedidoId: 'p1' },
      referenciaId: 'p1',
    },
    ...overrides,
  };
}

function prismaFake(overrides: {
  notificacoes?: Record<string, unknown>[];
  total?: number;
  notificacaoEncontrada?: Record<string, unknown> | null;
} = {}) {
  return {
    notificacaoUsuario: {
      findMany: jest.fn().mockResolvedValue(overrides.notificacoes ?? []),
      count: jest.fn().mockResolvedValue(overrides.total ?? 0),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'notificacaoEncontrada' in overrides ? overrides.notificacaoEncontrada : notificacaoBruta(),
        ),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        notificacaoBruta({ ...data }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    $transaction: jest.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
  };
}

describe('NotificacaoUsuarioService.listar', () => {
  it('filtra por usuarioId e pagina o resultado', async () => {
    const prisma = prismaFake({ notificacoes: [notificacaoBruta()], total: 1 });
    const service = new NotificacaoUsuarioService(prisma as never);

    const resultado = await service.listar('u1', { page: 1, limit: 20 });

    expect(prisma.notificacaoUsuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 'u1' } }),
    );
    expect(resultado.data).toHaveLength(1);
    expect(resultado.data[0].tipo).toBe('PEDIDO_SITUACAO_ALTERADA');
    expect(resultado.meta.total).toBe(1);
  });

  it('acrescenta lida:false ao where quando apenasNaoLidas e true', async () => {
    const prisma = prismaFake();
    const service = new NotificacaoUsuarioService(prisma as never);

    await service.listar('u1', { page: 1, limit: 20, apenasNaoLidas: true });

    expect(prisma.notificacaoUsuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 'u1', lida: false } }),
    );
  });
});

describe('NotificacaoUsuarioService.contarNaoLidas', () => {
  it('conta so as nao lidas do usuario', async () => {
    const prisma = prismaFake({ total: 5 });
    const service = new NotificacaoUsuarioService(prisma as never);

    const resultado = await service.contarNaoLidas('u1');

    expect(prisma.notificacaoUsuario.count).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', lida: false },
    });
    expect(resultado).toBe(5);
  });
});

describe('NotificacaoUsuarioService.marcarComoLida', () => {
  it('lanca NotFoundException quando a notificacao nao existe ou e de outro usuario (anti-IDOR)', async () => {
    const prisma = prismaFake({ notificacaoEncontrada: null });
    const service = new NotificacaoUsuarioService(prisma as never);

    await expect(service.marcarComoLida('u1', 'notif-de-outro')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.notificacaoUsuario.update).not.toHaveBeenCalled();
  });

  it('marca como lida quando a notificacao pertence ao usuario', async () => {
    const prisma = prismaFake();
    const service = new NotificacaoUsuarioService(prisma as never);

    const resultado = await service.marcarComoLida('u1', 'notif-1');

    expect(prisma.notificacaoUsuario.findFirst).toHaveBeenCalledWith({
      where: { id: 'notif-1', usuarioId: 'u1' },
    });
    expect(resultado.lida).toBe(true);
    expect(resultado.lidaEm).not.toBeNull();
  });
});

describe('NotificacaoUsuarioService.marcarTodasComoLidas', () => {
  it('atualiza so as nao lidas do usuario e devolve a quantidade', async () => {
    const prisma = prismaFake();
    const service = new NotificacaoUsuarioService(prisma as never);

    const resultado = await service.marcarTodasComoLidas('u1');

    expect(prisma.notificacaoUsuario.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', lida: false },
      data: { lida: true, lidaEm: expect.any(Date) },
    });
    expect(resultado.quantidade).toBe(3);
  });
});
