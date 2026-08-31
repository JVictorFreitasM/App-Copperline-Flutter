import { NotificacaoDispatchService } from './notificacao-dispatch.service';

function eventoFake(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'evento-1',
    tipo: 'PEDIDO_SITUACAO_ALTERADA',
    referenciaId: 'ref-1',
    titulo: 'Título',
    corpo: 'Corpo',
    dados: null,
    status: 'PENDENTE',
    criadoEm: new Date(),
    processadoEm: null,
    erro: null,
    ...overrides,
  };
}

function prismaFake(overrides: {
  pendentes?: unknown[];
  dispositivos?: { token: string; usuarioId?: string }[];
  favoritos?: { usuario: { dispositivos: { token: string }[] } }[];
  visita?: { vendedor: { supervisor: { usuarioId: string | null } | null } } | null;
  solicitacaoDesconto?: {
    aprovadorEsperado?: { usuarioId: string | null } | null;
    vendedorSolicitante?: { usuarioId: string | null };
  } | null;
} = {}) {
  return {
    eventoNotificacao: {
      findMany: jest.fn().mockResolvedValue(overrides.pendentes ?? []),
      update: jest.fn().mockResolvedValue(undefined),
    },
    dispositivoUsuario: {
      findMany: jest
        .fn()
        .mockImplementation(async ({ where }: { where?: { usuarioId?: string } } = {}) => {
          const todos = overrides.dispositivos ?? [];
          if (where?.usuarioId) {
            return todos.filter((d) => d.usuarioId === where.usuarioId);
          }
          return todos;
        }),
    },
    produtoFavorito: {
      findMany: jest.fn().mockResolvedValue(overrides.favoritos ?? []),
    },
    visita: {
      findUnique: jest
        .fn()
        .mockResolvedValue('visita' in overrides ? overrides.visita : null),
    },
    solicitacaoDesconto: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'solicitacaoDesconto' in overrides ? overrides.solicitacaoDesconto : null,
        ),
    },
  };
}

function pushClientFake(resultado: { sucesso: string[]; falha: string[] }) {
  return { enviar: jest.fn().mockResolvedValue(resultado) };
}

describe('NotificacaoDispatchService.processarPendentes', () => {
  it('broadcast: PEDIDO_SITUACAO_ALTERADA vai pra todos os DispositivoUsuario', async () => {
    const prisma = prismaFake({
      pendentes: [eventoFake({ tipo: 'PEDIDO_SITUACAO_ALTERADA' })],
      dispositivos: [{ token: 'token-a' }, { token: 'token-b' }],
    });
    const pushClient = pushClientFake({ sucesso: ['token-a', 'token-b'], falha: [] });
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(pushClient.enviar).toHaveBeenCalledWith(
      ['token-a', 'token-b'],
      expect.objectContaining({ titulo: 'Título', corpo: 'Corpo' }),
    );
    expect(prisma.eventoNotificacao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evento-1' },
        data: expect.objectContaining({ status: 'ENVIADO' }),
      }),
    );
  });

  it('broadcast: NOTA_FISCAL_REJEITADA tambem vai pra todos (nao filtra por favorito)', async () => {
    const prisma = prismaFake({
      pendentes: [eventoFake({ tipo: 'NOTA_FISCAL_REJEITADA' })],
      dispositivos: [{ token: 'token-a' }],
    });
    const pushClient = pushClientFake({ sucesso: ['token-a'], falha: [] });
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(prisma.produtoFavorito.findMany).not.toHaveBeenCalled();
    expect(pushClient.enviar).toHaveBeenCalledWith(['token-a'], expect.anything());
  });

  it('PRODUTO_REABASTECIDO: so vai pros dispositivos de quem favoritou o produto', async () => {
    const prisma = prismaFake({
      pendentes: [eventoFake({ tipo: 'PRODUTO_REABASTECIDO', referenciaId: 'produto-1' })],
      favoritos: [{ usuario: { dispositivos: [{ token: 'token-favorito' }] } }],
    });
    const pushClient = pushClientFake({ sucesso: ['token-favorito'], falha: [] });
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(prisma.produtoFavorito.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { produtoId: 'produto-1' } }),
    );
    expect(prisma.dispositivoUsuario.findMany).not.toHaveBeenCalled();
    expect(pushClient.enviar).toHaveBeenCalledWith(['token-favorito'], expect.anything());
  });

  it('marca ENVIADO (nao erro) quando nao ha nenhum destinatario - nao e falha, so ninguem cadastrado', async () => {
    const prisma = prismaFake({
      pendentes: [eventoFake({ tipo: 'PRODUTO_REABASTECIDO' })],
      favoritos: [],
    });
    const pushClient = pushClientFake({ sucesso: [], falha: [] });
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(pushClient.enviar).not.toHaveBeenCalled();
    expect(prisma.eventoNotificacao.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ENVIADO' }) }),
    );
  });

  it('VISITA_CANCELADA: so vai pro dispositivo do supervisor DIRETO do vendedor (nunca broadcast)', async () => {
    const prisma = prismaFake({
      pendentes: [eventoFake({ tipo: 'VISITA_CANCELADA', referenciaId: 'visita-1' })],
      visita: { vendedor: { supervisor: { usuarioId: 'usuario-supervisor' } } },
      dispositivos: [
        { token: 'token-supervisor', usuarioId: 'usuario-supervisor' },
        { token: 'token-outro-vendedor', usuarioId: 'outro-usuario' },
      ],
    });
    const pushClient = pushClientFake({ sucesso: ['token-supervisor'], falha: [] });
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(prisma.visita.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'visita-1' } }),
    );
    expect(pushClient.enviar).toHaveBeenCalledWith(['token-supervisor'], expect.anything());
  });

  it('VISITA_CANCELADA: marca ENVIADO sem chamar push quando o vendedor nao tem supervisor vinculado', async () => {
    const prisma = prismaFake({
      pendentes: [eventoFake({ tipo: 'VISITA_CANCELADA', referenciaId: 'visita-1' })],
      visita: { vendedor: { supervisor: null } },
    });
    const pushClient = pushClientFake({ sucesso: [], falha: [] });
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(pushClient.enviar).not.toHaveBeenCalled();
    expect(prisma.eventoNotificacao.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ENVIADO' }) }),
    );
  });

  it('SOLICITACAO_DESCONTO_CRIADA: so vai pro dispositivo do aprovador esperado (nunca broadcast)', async () => {
    const prisma = prismaFake({
      pendentes: [eventoFake({ tipo: 'SOLICITACAO_DESCONTO_CRIADA', referenciaId: 'sol-1' })],
      solicitacaoDesconto: { aprovadorEsperado: { usuarioId: 'usuario-supervisor' } },
      dispositivos: [
        { token: 'token-supervisor', usuarioId: 'usuario-supervisor' },
        { token: 'token-outro', usuarioId: 'outro-usuario' },
      ],
    });
    const pushClient = pushClientFake({ sucesso: ['token-supervisor'], falha: [] });
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(prisma.solicitacaoDesconto.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sol-1' } }),
    );
    expect(pushClient.enviar).toHaveBeenCalledWith(['token-supervisor'], expect.anything());
  });

  it('SOLICITACAO_DESCONTO_DECIDIDA: so vai pro dispositivo do vendedor solicitante (nunca broadcast)', async () => {
    const prisma = prismaFake({
      pendentes: [eventoFake({ tipo: 'SOLICITACAO_DESCONTO_DECIDIDA', referenciaId: 'sol-1' })],
      solicitacaoDesconto: { vendedorSolicitante: { usuarioId: 'usuario-vendedor' } },
      dispositivos: [
        { token: 'token-vendedor', usuarioId: 'usuario-vendedor' },
        { token: 'token-outro', usuarioId: 'outro-usuario' },
      ],
    });
    const pushClient = pushClientFake({ sucesso: ['token-vendedor'], falha: [] });
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(pushClient.enviar).toHaveBeenCalledWith(['token-vendedor'], expect.anything());
  });

  it('marca ERRO e continua processando os outros eventos do lote quando um falha', async () => {
    const prisma = prismaFake({
      pendentes: [
        eventoFake({ id: 'evento-1' }),
        eventoFake({ id: 'evento-2' }),
      ],
      dispositivos: [{ token: 'token-a' }],
    });
    const pushClient = {
      enviar: jest
        .fn()
        .mockRejectedValueOnce(new Error('FCM indisponível'))
        .mockResolvedValueOnce({ sucesso: ['token-a'], falha: [] }),
    };
    const service = new NotificacaoDispatchService(prisma as never, pushClient as never);

    await service.processarPendentes();

    expect(pushClient.enviar).toHaveBeenCalledTimes(2);
    expect(prisma.eventoNotificacao.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'evento-1' },
        data: expect.objectContaining({ status: 'ERRO' }),
      }),
    );
    expect(prisma.eventoNotificacao.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'evento-2' },
        data: expect.objectContaining({ status: 'ENVIADO' }),
      }),
    );
  });
});
