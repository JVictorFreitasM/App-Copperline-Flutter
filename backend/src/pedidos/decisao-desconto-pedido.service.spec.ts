import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DecisaoDescontoPedidoService } from './decisao-desconto-pedido.service';

const ESCOPO_TODOS = { tipo: 'TODOS' } as const;

function montar(
  opcoes: {
    pedido?: Record<string, unknown> | null;
    solicitacao?: Record<string, unknown> | null;
    autorizacaoFalha?: Error;
  } = {},
) {
  const pedido =
    'pedido' in opcoes
      ? opcoes.pedido
      : {
          id: 'pedido-1',
          statusLocal: 'AGUARDANDO_APROVACAO',
          itens: [
            { id: 'a', statusAprovacao: 'APROVADO' }, // ja aceito (dentro da alcada)
            { id: 'b', statusAprovacao: 'PENDENTE' },
            { id: 'c', statusAprovacao: 'PENDENTE' },
          ],
        };
  const prisma = {
    pedido: { findFirst: jest.fn().mockResolvedValue(pedido) },
    solicitacaoDesconto: {
      findFirst: jest
        .fn()
        .mockResolvedValue('solicitacao' in opcoes ? opcoes.solicitacao : { id: 'sol-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'sol-1', pedidoId: 'pedido-1' }),
    },
    pedidoItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const solicitacoes = {
    autorizarDecisao: opcoes.autorizacaoFalha
      ? jest.fn().mockRejectedValue(opcoes.autorizacaoFalha)
      : jest.fn().mockResolvedValue({ aprovadorVendedor: { id: 'vend-sup' } }),
    aprovar: jest.fn().mockResolvedValue({ id: 'sol-1', status: 'APROVADO' }),
    rejeitar: jest.fn().mockResolvedValue({ id: 'sol-1', status: 'REJEITADO' }),
    obterDto: jest.fn().mockResolvedValue({ id: 'sol-1', status: 'APROVADO' }),
  };
  const criarPedido = {
    concluirPedidoAposDecisao: jest
      .fn()
      .mockResolvedValue({ resultado: 'ENVIADO', idExternoErp: 'erp-1' }),
  };
  const service = new DecisaoDescontoPedidoService(
    prisma as never,
    solicitacoes as never,
    criarPedido as never,
  );
  return { service, prisma, solicitacoes, criarPedido };
}

const BASE = { pedidoId: 'pedido-1', usuarioId: 'u-sup', escopo: ESCOPO_TODOS } as const;

describe('DecisaoDescontoPedidoService.decidir', () => {
  it('404 quando o pedido nao existe no escopo', async () => {
    const { service } = montar({ pedido: null });
    await expect(service.decidir({ ...BASE, acao: 'aprovar' })).rejects.toThrow(NotFoundException);
  });

  it('409 quando o pedido nao esta aguardando aprovacao', async () => {
    const { service } = montar({ pedido: { id: 'p', statusLocal: 'ENVIADO', itens: [] } });
    await expect(service.decidir({ ...BASE, acao: 'aprovar' })).rejects.toThrow(ConflictException);
  });

  it('409 quando nao ha solicitacao pendente', async () => {
    const { service } = montar({ solicitacao: null });
    await expect(service.decidir({ ...BASE, acao: 'aprovar' })).rejects.toThrow(ConflictException);
  });

  it('propaga o Forbidden de quem nao tem alcada / e o proprio solicitante (nada e gravado)', async () => {
    const { service, prisma, criarPedido } = montar({
      autorizacaoFalha: new ForbiddenException('Papel insuficiente'),
    });

    await expect(
      service.decidir({ ...BASE, itemIds: ['b'], acao: 'aprovar' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.pedidoItem.updateMany).not.toHaveBeenCalled();
    expect(criarPedido.concluirPedidoAposDecisao).not.toHaveBeenCalled();
  });

  it('decide 1 de 2 itens pendentes: grava so a decisao e NAO fecha o pedido', async () => {
    const { service, prisma, criarPedido } = montar();

    const resultado = await service.decidir({ ...BASE, itemIds: ['b'], acao: 'rejeitar' });

    expect(resultado).toEqual({ concluido: false, resultado: null });
    expect(prisma.pedidoItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['b'] } }),
        data: expect.objectContaining({ statusAprovacao: 'REJEITADO', decididoPorId: 'u-sup' }),
      }),
    );
    expect(criarPedido.concluirPedidoAposDecisao).not.toHaveBeenCalled();
  });

  it('decide o ULTIMO item pendente: fecha o pedido com as decisoes desta chamada', async () => {
    const { service, criarPedido } = montar({
      pedido: {
        id: 'pedido-1',
        statusLocal: 'AGUARDANDO_APROVACAO',
        itens: [
          { id: 'b', statusAprovacao: 'APROVADO' }, // decidido antes
          { id: 'c', statusAprovacao: 'PENDENTE' },
        ],
      },
    });

    const resultado = await service.decidir({ ...BASE, itemIds: ['c'], acao: 'rejeitar' });

    expect(resultado).toEqual({ concluido: true, resultado: 'ENVIADO' });
    expect(criarPedido.concluirPedidoAposDecisao).toHaveBeenCalledWith(
      expect.objectContaining({
        pedidoId: 'pedido-1',
        solicitacaoId: 'sol-1',
        decisoes: [{ itemId: 'c', status: 'REJEITADO' }],
        aprovadorVendedorId: 'vend-sup',
      }),
    );
  });

  it('"todos" (sem itemIds) decide todos os pendentes de uma vez e fecha', async () => {
    const { service, criarPedido } = montar();

    const resultado = await service.decidir({ ...BASE, acao: 'aprovar' });

    expect(resultado.concluido).toBe(true);
    expect(criarPedido.concluirPedidoAposDecisao).toHaveBeenCalledWith(
      expect.objectContaining({
        decisoes: [
          { itemId: 'b', status: 'APROVADO' },
          { itemId: 'c', status: 'APROVADO' },
        ],
      }),
    );
  });

  it('item inexistente no pedido: 404; item ja decidido / sem alcada exigida: 409', async () => {
    const { service } = montar();

    await expect(
      service.decidir({ ...BASE, itemIds: ['x'], acao: 'aprovar' }),
    ).rejects.toThrow(NotFoundException);
    // 'a' ja nasceu APROVADO (desconto dentro da alcada) - nao e' decidivel
    await expect(
      service.decidir({ ...BASE, itemIds: ['a'], acao: 'rejeitar' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('DecisaoDescontoPedidoService.decidirSolicitacao', () => {
  it('solicitacao com pedido: decide todos os itens pendentes e devolve a solicitacao', async () => {
    const { service, criarPedido, solicitacoes } = montar();

    const dto = await service.decidirSolicitacao('sol-1', 'u-sup', 'aprovar');

    expect(criarPedido.concluirPedidoAposDecisao).toHaveBeenCalled();
    expect(solicitacoes.obterDto).toHaveBeenCalledWith('sol-1');
    expect(dto).toEqual({ id: 'sol-1', status: 'APROVADO' });
  });

  it('solicitacao SEM pedido vinculado (legado): segue o fluxo antigo da solicitacao', async () => {
    const { service, prisma, solicitacoes, criarPedido } = montar();
    prisma.solicitacaoDesconto.findUnique.mockResolvedValue({ id: 'sol-1', pedidoId: null });

    await service.decidirSolicitacao('sol-1', 'u-sup', 'rejeitar');

    expect(solicitacoes.rejeitar).toHaveBeenCalledWith('sol-1', 'u-sup');
    expect(criarPedido.concluirPedidoAposDecisao).not.toHaveBeenCalled();
  });
});
