import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MensagensNotificacaoService } from './mensagens-notificacao.service';
import type { EnviarMensagemDto } from './dto/enviar-mensagem.dto';

type VendedorFake = { id: string; nome: string | null; usuarioId: string | null };

function dto(overrides: Partial<EnviarMensagemDto> = {}): EnviarMensagemDto {
  return { destino: 'TODOS', assunto: 'Aviso', mensagem: 'Reunião às 9h', ...overrides };
}

function prismaFake(overrides: {
  original?: Record<string, unknown> | null;
  vendedores?: VendedorFake[];
  vendedor?: VendedorFake | null;
  grupo?: { membros: { vendedor: VendedorFake }[] } | null;
} = {}) {
  const tx = {
    mensagemNotificacao: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) },
    eventoNotificacao: { create: jest.fn().mockResolvedValue({ id: 'evento-1' }) },
    notificacaoUsuario: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  return {
    tx,
    mensagemNotificacao: {
      findUnique: jest.fn().mockResolvedValue('original' in overrides ? overrides.original : null),
    },
    vendedor: {
      findMany: jest.fn().mockResolvedValue(overrides.vendedores ?? []),
      findUnique: jest.fn().mockResolvedValue('vendedor' in overrides ? overrides.vendedor : null),
    },
    grupoMensagem: {
      findUnique: jest.fn().mockResolvedValue('grupo' in overrides ? overrides.grupo : null),
    },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
}

describe('MensagensNotificacaoService.enviar', () => {
  it('TODOS: grava mensagem, evento MENSAGEM_DIRETA e um NotificacaoUsuario por usuario vinculado', async () => {
    const prisma = prismaFake({
      vendedores: [
        { id: 'v1', nome: 'Ana', usuarioId: 'u1' },
        { id: 'v2', nome: 'Bia', usuarioId: 'u2' },
        { id: 'v3', nome: 'Caio', usuarioId: null },
      ],
    });
    const service = new MensagensNotificacaoService(prisma as never);

    const resultado = await service.enviar('autor-1', dto());

    expect(prisma.vendedor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { inativo: false } }),
    );
    expect(prisma.tx.mensagemNotificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        autorId: 'autor-1',
        destino: 'TODOS',
        vendedorId: null,
        grupoId: null,
        totalDestinatarios: 2,
      }),
    });
    expect(prisma.tx.eventoNotificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'MENSAGEM_DIRETA',
        referenciaId: 'msg-1',
        titulo: 'Aviso',
        corpo: 'Reunião às 9h',
        dados: { mensagemId: 'msg-1' },
      }),
    });
    expect(prisma.tx.notificacaoUsuario.createMany).toHaveBeenCalledWith({
      data: [
        { usuarioId: 'u1', eventoId: 'evento-1' },
        { usuarioId: 'u2', eventoId: 'evento-1' },
      ],
      skipDuplicates: true,
    });
    expect(resultado).toEqual({ id: 'msg-1', totalDestinatarios: 2, semAppVinculado: 1 });
  });

  it('VENDEDOR: envia so pro vendedor escolhido', async () => {
    const prisma = prismaFake({ vendedor: { id: 'v1', nome: 'Ana', usuarioId: 'u1' } });
    const service = new MensagensNotificacaoService(prisma as never);

    const resultado = await service.enviar('autor-1', dto({ destino: 'VENDEDOR', vendedorId: 'v1' }));

    expect(prisma.vendedor.findMany).not.toHaveBeenCalled();
    expect(prisma.tx.notificacaoUsuario.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ usuarioId: 'u1', eventoId: 'evento-1' }] }),
    );
    expect(resultado.totalDestinatarios).toBe(1);
  });

  it('VENDEDOR inexistente: 404 sem gravar nada', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new MensagensNotificacaoService(prisma as never);

    await expect(
      service.enviar('autor-1', dto({ destino: 'VENDEDOR', vendedorId: 'nao-existe' })),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('VENDEDOR sem usuario vinculado: 422 (ninguem receberia), sem gravar nada', async () => {
    const prisma = prismaFake({ vendedor: { id: 'v1', nome: 'Ana', usuarioId: null } });
    const service = new MensagensNotificacaoService(prisma as never);

    await expect(
      service.enviar('autor-1', dto({ destino: 'VENDEDOR', vendedorId: 'v1' })),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('GRUPO: envia so pros membros ativos do grupo, sem duplicar usuario', async () => {
    const prisma = prismaFake({
      grupo: {
        membros: [
          { vendedor: { id: 'v1', nome: 'Ana', usuarioId: 'u1' } },
          { vendedor: { id: 'v2', nome: 'Ana (2a conta)', usuarioId: 'u1' } },
          { vendedor: { id: 'v3', nome: 'Bia', usuarioId: 'u3' } },
        ],
      },
    });
    const service = new MensagensNotificacaoService(prisma as never);

    const resultado = await service.enviar('autor-1', dto({ destino: 'GRUPO', grupoId: 'g1' }));

    expect(prisma.grupoMensagem.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'g1' } }),
    );
    expect(prisma.tx.mensagemNotificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ destino: 'GRUPO', grupoId: 'g1', vendedorId: null }),
    });
    expect(prisma.tx.notificacaoUsuario.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { usuarioId: 'u1', eventoId: 'evento-1' },
          { usuarioId: 'u3', eventoId: 'evento-1' },
        ],
      }),
    );
    expect(resultado.totalDestinatarios).toBe(2);
  });

  it('GRUPO inexistente: 404', async () => {
    const prisma = prismaFake({ grupo: null });
    const service = new MensagensNotificacaoService(prisma as never);

    await expect(
      service.enviar('autor-1', dto({ destino: 'GRUPO', grupoId: 'nao-existe' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('TODOS sem nenhum vendedor com app: 422', async () => {
    const prisma = prismaFake({ vendedores: [{ id: 'v1', nome: 'Ana', usuarioId: null }] });
    const service = new MensagensNotificacaoService(prisma as never);

    await expect(service.enviar('autor-1', dto())).rejects.toThrow(UnprocessableEntityException);
  });
});

describe('MensagensNotificacaoService.reenviar', () => {
  const originalDeGrupo = {
    id: 'msg-original',
    destino: 'GRUPO',
    vendedorId: null,
    grupoId: 'g1',
    assunto: 'Aviso',
    corpo: 'Reunião às 9h',
  };

  it('reenvia o mesmo conteudo pro mesmo destino, resolvendo os destinatarios DE NOVO', async () => {
    const prisma = prismaFake({
      original: originalDeGrupo,
      grupo: { membros: [{ vendedor: { id: 'v9', nome: 'Novato', usuarioId: 'u9' } }] },
    });
    const service = new MensagensNotificacaoService(prisma as never);

    const resultado = await service.reenviar('autor-2', 'msg-original');

    expect(prisma.tx.mensagemNotificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        autorId: 'autor-2',
        destino: 'GRUPO',
        grupoId: 'g1',
        assunto: 'Aviso',
        corpo: 'Reunião às 9h',
        periodicaId: null,
      }),
    });
    expect(prisma.tx.notificacaoUsuario.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ usuarioId: 'u9', eventoId: 'evento-1' }] }),
    );
    expect(resultado.totalDestinatarios).toBe(1);
  });

  it('mensagem inexistente -> 404', async () => {
    const prisma = prismaFake({ original: null });
    const service = new MensagensNotificacaoService(prisma as never);

    await expect(service.reenviar('autor-2', 'nao-existe')).rejects.toThrow(NotFoundException);
  });

  it.each([
    ['GRUPO', { destino: 'GRUPO', vendedorId: null, grupoId: null }],
    ['VENDEDOR', { destino: 'VENDEDOR', vendedorId: null, grupoId: null }],
  ])('destino %s removido: 422 em vez de cair em Todos', async (_nome, destino) => {
    const prisma = prismaFake({ original: { ...originalDeGrupo, ...destino } });
    const service = new MensagensNotificacaoService(prisma as never);

    await expect(service.reenviar('autor-2', 'msg-original')).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('MensagensNotificacaoService.enviar - origem periodica', () => {
  it('grava periodicaId quando informado', async () => {
    const prisma = prismaFake({ vendedores: [{ id: 'v1', nome: 'Ana', usuarioId: 'u1' }] });
    const service = new MensagensNotificacaoService(prisma as never);

    await service.enviar('autor-1', dto(), 'periodica-9');

    expect(prisma.tx.mensagemNotificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ periodicaId: 'periodica-9' }),
    });
  });
});
