import { registrarEventoNotificacao } from './evento-notificacao.service';

function txFake(overrides: {
  favoritos?: { usuarioId: string }[];
  visita?: Record<string, unknown> | null;
  solicitacao?: Record<string, unknown> | null;
  usuarios?: { id: string }[];
  vendedor?: { usuarioId: string | null } | null;
} = {}) {
  return {
    eventoNotificacao: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'evento-1',
        ...data,
      })),
    },
    notificacaoUsuario: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    produtoFavorito: {
      findMany: jest.fn().mockResolvedValue(overrides.favoritos ?? []),
    },
    visita: {
      findUnique: jest.fn().mockResolvedValue('visita' in overrides ? overrides.visita : null),
    },
    solicitacaoDesconto: {
      findUnique: jest
        .fn()
        .mockResolvedValue('solicitacao' in overrides ? overrides.solicitacao : null),
    },
    usuario: {
      findMany: jest.fn().mockResolvedValue(overrides.usuarios ?? []),
    },
    vendedor: {
      findUnique: jest.fn().mockResolvedValue('vendedor' in overrides ? overrides.vendedor : null),
    },
  };
}

const INPUT_BASE = {
  referenciaId: 'ref-1',
  titulo: 'Título',
  corpo: 'Corpo',
};

describe('registrarEventoNotificacao', () => {
  it('cria o EventoNotificacao independente de haver destinatario', async () => {
    const tx = txFake({ usuarios: [] });

    await registrarEventoNotificacao(tx as never, {
      ...INPUT_BASE,
      tipo: 'PEDIDO_SITUACAO_ALTERADA',
    });

    expect(tx.eventoNotificacao.create).toHaveBeenCalled();
    expect(tx.notificacaoUsuario.createMany).not.toHaveBeenCalled();
  });

  it('PEDIDO_SITUACAO_ALTERADA/NOTA_FISCAL_REJEITADA: cria NotificacaoUsuario pra TODO usuario cadastrado (broadcast)', async () => {
    const tx = txFake({ usuarios: [{ id: 'u1' }, { id: 'u2' }] });

    await registrarEventoNotificacao(tx as never, {
      ...INPUT_BASE,
      tipo: 'NOTA_FISCAL_REJEITADA',
    });

    expect(tx.notificacaoUsuario.createMany).toHaveBeenCalledWith({
      data: [
        { usuarioId: 'u1', eventoId: 'evento-1' },
        { usuarioId: 'u2', eventoId: 'evento-1' },
      ],
      skipDuplicates: true,
    });
  });

  it('PRODUTO_REABASTECIDO: cria NotificacaoUsuario so pra quem favoritou', async () => {
    const tx = txFake({ favoritos: [{ usuarioId: 'u1' }] });

    await registrarEventoNotificacao(tx as never, {
      ...INPUT_BASE,
      tipo: 'PRODUTO_REABASTECIDO',
    });

    expect(tx.produtoFavorito.findMany).toHaveBeenCalledWith({
      where: { produtoId: 'ref-1' },
      select: { usuarioId: true },
    });
    expect(tx.notificacaoUsuario.createMany).toHaveBeenCalledWith({
      data: [{ usuarioId: 'u1', eventoId: 'evento-1' }],
      skipDuplicates: true,
    });
  });

  it('VISITA_CANCELADA: cria so pro supervisor DIRETO do vendedor', async () => {
    const tx = txFake({
      visita: { vendedor: { supervisor: { usuarioId: 'supervisor-1' } } },
    });

    await registrarEventoNotificacao(tx as never, {
      ...INPUT_BASE,
      tipo: 'VISITA_CANCELADA',
    });

    expect(tx.notificacaoUsuario.createMany).toHaveBeenCalledWith({
      data: [{ usuarioId: 'supervisor-1', eventoId: 'evento-1' }],
      skipDuplicates: true,
    });
  });

  it('VISITA_CANCELADA: nao cria nada quando o vendedor nao tem supervisor vinculado', async () => {
    const tx = txFake({ visita: { vendedor: { supervisor: null } } });

    await registrarEventoNotificacao(tx as never, {
      ...INPUT_BASE,
      tipo: 'VISITA_CANCELADA',
    });

    expect(tx.notificacaoUsuario.createMany).not.toHaveBeenCalled();
  });

  it('SOLICITACAO_DESCONTO_CRIADA: cria so pro aprovador esperado', async () => {
    const tx = txFake({
      solicitacao: { aprovadorEsperado: { usuarioId: 'aprovador-1' } },
    });

    await registrarEventoNotificacao(tx as never, {
      ...INPUT_BASE,
      tipo: 'SOLICITACAO_DESCONTO_CRIADA',
    });

    expect(tx.notificacaoUsuario.createMany).toHaveBeenCalledWith({
      data: [{ usuarioId: 'aprovador-1', eventoId: 'evento-1' }],
      skipDuplicates: true,
    });
  });

  it('SOLICITACAO_DESCONTO_DECIDIDA: cria so pro vendedor solicitante', async () => {
    const tx = txFake({
      solicitacao: { vendedorSolicitante: { usuarioId: 'vendedor-1' } },
    });

    await registrarEventoNotificacao(tx as never, {
      ...INPUT_BASE,
      tipo: 'SOLICITACAO_DESCONTO_DECIDIDA',
    });

    expect(tx.notificacaoUsuario.createMany).toHaveBeenCalledWith({
      data: [{ usuarioId: 'vendedor-1', eventoId: 'evento-1' }],
      skipDuplicates: true,
    });
  });

  it.each(['RELATORIO_MANHA_PEDIDOS', 'RELATORIO_FIM_DIA_PEDIDOS'] as const)(
    '%s: cria so pro proprio vendedor (referenciaId = Vendedor.id)',
    async (tipo) => {
      const tx = txFake({ vendedor: { usuarioId: 'usuario-vendedor' } });

      await registrarEventoNotificacao(tx as never, { ...INPUT_BASE, tipo });

      expect(tx.vendedor.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ref-1' } }),
      );
      expect(tx.notificacaoUsuario.createMany).toHaveBeenCalledWith({
        data: [{ usuarioId: 'usuario-vendedor', eventoId: 'evento-1' }],
        skipDuplicates: true,
      });
    },
  );

  it('RELATORIO_MANHA_PEDIDOS: nao cria nada quando o vendedor nao tem usuario vinculado', async () => {
    const tx = txFake({ vendedor: { usuarioId: null } });

    await registrarEventoNotificacao(tx as never, {
      ...INPUT_BASE,
      tipo: 'RELATORIO_MANHA_PEDIDOS',
    });

    expect(tx.notificacaoUsuario.createMany).not.toHaveBeenCalled();
  });
});
