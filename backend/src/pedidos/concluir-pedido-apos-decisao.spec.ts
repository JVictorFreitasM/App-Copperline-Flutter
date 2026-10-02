import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { CriarPedidoService } from './criar-pedido.service';

// Fechamento do pedido depois da decisao por item: so' os aceitos seguem
// (preco LIQUIDO ao Radar), todos recusados cancela o pedido e avisa o
// vendedor, falha do Radar nao grava nada.

function decimal(n: number) {
  return { toNumber: () => n, toString: () => String(n) };
}

function itemDoBanco(
  id: string,
  statusAprovacao: 'PENDENTE' | 'APROVADO' | 'REJEITADO',
  percentualDesconto: number,
  valorTotal: number,
) {
  return {
    id,
    produtoId: `produto-${id}`,
    statusAprovacao,
    // PECA: quantidade externa = quantidade interna, sem conversao de KM
    quantidadeVenda: decimal(2),
    unidade: 'PECA',
    valorUnitarioBruto: decimal(100),
    valorTotal: decimal(valorTotal),
    percentualDesconto: decimal(percentualDesconto),
    observacoes: null,
  };
}

function montar(
  itens: ReturnType<typeof itemDoBanco>[],
  opcoes: { statusLocal?: string; erroNoRadar?: boolean } = {},
) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    pedido: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'pedido-1',
        statusLocal: opcoes.statusLocal ?? 'AGUARDANDO_APROVACAO',
        codigoTabelaPreco: '110',
        itens,
        cliente: { idExternoErp: 'cliente-ext' },
        vendedor: { id: 'vend-1', idExternoErp: 'vend-ext' },
        formaPagamento: { idExternoErp: 'forma-ext' },
        condicaoPagamento: { idExternoErp: 'cond-ext', parcelas: [{ percentual: 100, prazo: 0 }] },
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    pedidoItem: { update: jest.fn().mockResolvedValue(undefined) },
    pedidoHistoricoStatus: { create: jest.fn().mockResolvedValue(undefined) },
    solicitacaoDesconto: {
      update: jest.fn().mockResolvedValue(undefined),
      findUnique: jest
        .fn()
        .mockResolvedValue({ vendedorSolicitante: { usuarioId: 'usuario-vendedor' } }),
    },
    eventoNotificacao: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'evento-1',
        ...data,
      })),
    },
    notificacaoUsuario: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    $transaction: jest.fn().mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx)),
    produto: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({
          id,
          idExternoErp: `ext-${id}`,
          pesoLiquidoKg: null,
          pesoBrutoKg: null,
        })),
      ),
    },
    tabelaPreco: {
      findUnique: jest.fn().mockResolvedValue({ idVendaProdutoExterno: 'tabela-venda-ext' }),
    },
    pedido: { update: jest.fn().mockResolvedValue(undefined) },
  };
  const pedidoErpClientService = {
    criar: opcoes.erroNoRadar
      ? jest.fn().mockRejectedValue(new Error('Radar fora do ar'))
      : jest.fn().mockResolvedValue({ idExterno: 'erp-99', codigoIntegrador: 'cod-99' }),
    buscarCabecalhoAtualizado: jest.fn().mockResolvedValue(null),
  };
  const service = new CriarPedidoService(
    prisma as never,
    {} as never,
    {} as never,
    pedidoErpClientService as never,
    { obterCodigoSelecionado: jest.fn().mockResolvedValue('110') } as never,
    {} as never,
    {} as never,
  );
  return { service, tx, prisma, pedidoErpClientService };
}

const ENTRADA = {
  pedidoId: 'pedido-1',
  solicitacaoId: 'sol-1',
  aprovadorUsuarioId: 'usuario-sup',
  aprovadorVendedorId: 'vend-sup',
};

describe('CriarPedidoService.concluirPedidoAposDecisao', () => {
  it('2 de 3 aceitos: envia so os aceitos ao Radar com preco LIQUIDO e percentual 0, e marca o recusado', async () => {
    const { service, tx, pedidoErpClientService } = montar([
      itemDoBanco('a', 'APROVADO', 0, 200), // dentro da alcada, ja aceito
      itemDoBanco('b', 'PENDENTE', 30, 140), // 100 -30% = 70 x 2
      itemDoBanco('c', 'PENDENTE', 40, 120),
    ]);

    const resultado = await service.concluirPedidoAposDecisao({
      ...ENTRADA,
      decisoes: [
        { itemId: 'b', status: 'APROVADO' },
        { itemId: 'c', status: 'REJEITADO' },
      ],
    });

    expect(resultado).toEqual({
      resultado: 'ENVIADO',
      idExternoErp: 'erp-99',
      itensAceitos: 2,
      itensRecusados: 1,
    });
    const payload = pedidoErpClientService.criar.mock.calls[0][0];
    expect(payload.percentualDesconto).toBe(0);
    expect(payload.itens).toHaveLength(2);
    expect(payload.itens.map((i: { produtoIdExterno: string }) => i.produtoIdExterno)).toEqual([
      'ext-produto-a',
      'ext-produto-b',
    ]);
    // 100 bruto: sem desconto = 100; com 30% = 70 (valor ja liquido)
    expect(payload.itens.map((i: { valorUnitario: number }) => i.valorUnitario)).toEqual([
      100, 70,
    ]);
    expect(tx.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusLocal: 'ENVIADO',
          idExternoErp: 'erp-99',
          valorTotal: 340, // 200 + 140 (o recusado fica de fora)
        }),
      }),
    );
    expect(tx.solicitacaoDesconto.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APROVADO' }) }),
    );
  });

  it('todos recusados: pedido CANCELADO, NAO chama o Radar e avisa o vendedor com pedidoId', async () => {
    const { service, tx, pedidoErpClientService } = montar([
      itemDoBanco('b', 'PENDENTE', 30, 140),
      itemDoBanco('c', 'PENDENTE', 40, 120),
    ]);

    const resultado = await service.concluirPedidoAposDecisao({
      ...ENTRADA,
      decisoes: [
        { itemId: 'b', status: 'REJEITADO' },
        { itemId: 'c', status: 'REJEITADO' },
      ],
    });

    expect(resultado.resultado).toBe('CANCELADO');
    expect(resultado.idExternoErp).toBeNull();
    expect(pedidoErpClientService.criar).not.toHaveBeenCalled();
    expect(tx.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statusLocal: 'CANCELADO' }) }),
    );
    expect(tx.solicitacaoDesconto.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJEITADO' }) }),
    );
    const evento = tx.eventoNotificacao.create.mock.calls[0][0].data;
    expect(evento.titulo).toBe('Pedido recusado');
    expect(evento.corpo).toContain('Todos os itens');
    expect(evento.corpo).toContain('pedido inteiro foi recusado');
    expect(evento.dados).toEqual(expect.objectContaining({ pedidoId: 'pedido-1' }));
    expect(tx.notificacaoUsuario.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ usuarioId: 'usuario-vendedor', eventoId: 'evento-1' }] }),
    );
  });

  it('Radar falha: lanca 503 e a transacao inteira e abandonada (nada de decisao gravada como concluida)', async () => {
    const { service, tx } = montar([itemDoBanco('b', 'PENDENTE', 30, 140)], {
      erroNoRadar: true,
    });

    await expect(
      service.concluirPedidoAposDecisao({
        ...ENTRADA,
        decisoes: [{ itemId: 'b', status: 'APROVADO' }],
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    // a transacao aborta antes de gravar o pedido como ENVIADO
    expect(tx.pedido.update).not.toHaveBeenCalled();
    expect(tx.solicitacaoDesconto.update).not.toHaveBeenCalled();
  });

  it('pedido que nao esta mais AGUARDANDO_APROVACAO: 409 (nunca envia duas vezes)', async () => {
    const { service, pedidoErpClientService } = montar([itemDoBanco('b', 'PENDENTE', 30, 140)], {
      statusLocal: 'ENVIADO',
    });

    await expect(
      service.concluirPedidoAposDecisao({
        ...ENTRADA,
        decisoes: [{ itemId: 'b', status: 'APROVADO' }],
      }),
    ).rejects.toThrow(ConflictException);
    expect(pedidoErpClientService.criar).not.toHaveBeenCalled();
  });

  it('tranca a linha do pedido (FOR UPDATE) antes de decidir', async () => {
    const { service, tx } = montar([itemDoBanco('b', 'PENDENTE', 30, 140)]);

    await service.concluirPedidoAposDecisao({
      ...ENTRADA,
      decisoes: [{ itemId: 'b', status: 'APROVADO' }],
    });

    expect(tx.$queryRaw).toHaveBeenCalled();
  });
});
