import { RelatorioDiarioNotificacaoService } from './relatorio-diario-notificacao.service';

jest.mock('./evento-notificacao.service', () => ({
  registrarEventoNotificacao: jest.fn(),
}));

import { registrarEventoNotificacao } from './evento-notificacao.service';

function vendedor(overrides: Record<string, unknown> = {}) {
  return {
    vendedorId: 'v1',
    vendedorNome: 'Vendedor Um',
    totalPedidos: 0,
    pendentesAtuais: 0,
    pedidos: [],
    ...overrides,
  };
}

function relatorioPedidosServiceFake(vendedores: ReturnType<typeof vendedor>[]) {
  return { obterParaVendedoresAtivos: jest.fn().mockResolvedValue(vendedores) };
}

function prismaFake() {
  return { $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn({})) };
}

describe('RelatorioDiarioNotificacaoService.gerar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('so registra evento pra vendedor com pedido no dia ou pendencia em aberto', async () => {
    const relatorioPedidosService = relatorioPedidosServiceFake([
      vendedor({ vendedorId: 'com-pedido', totalPedidos: 2 }),
      vendedor({ vendedorId: 'com-pendencia', pendentesAtuais: 1 }),
      vendedor({ vendedorId: 'sem-atividade' }),
    ]);
    const service = new RelatorioDiarioNotificacaoService(
      relatorioPedidosService as never,
      prismaFake() as never,
    );

    await service.gerar('MANHA');

    expect(registrarEventoNotificacao).toHaveBeenCalledTimes(2);
    const referenciaIds = (registrarEventoNotificacao as jest.Mock).mock.calls.map(
      ([, input]) => input.referenciaId,
    );
    expect(referenciaIds).toEqual(['com-pedido', 'com-pendencia']);
  });

  it('MANHA: usa tipo RELATORIO_MANHA_PEDIDOS', async () => {
    const relatorioPedidosService = relatorioPedidosServiceFake([
      vendedor({ totalPedidos: 1 }),
    ]);
    const service = new RelatorioDiarioNotificacaoService(
      relatorioPedidosService as never,
      prismaFake() as never,
    );

    await service.gerar('MANHA');

    expect(registrarEventoNotificacao).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipo: 'RELATORIO_MANHA_PEDIDOS', referenciaId: 'v1' }),
    );
  });

  it('FIM_DIA: usa tipo RELATORIO_FIM_DIA_PEDIDOS', async () => {
    const relatorioPedidosService = relatorioPedidosServiceFake([
      vendedor({ totalPedidos: 1 }),
    ]);
    const service = new RelatorioDiarioNotificacaoService(
      relatorioPedidosService as never,
      prismaFake() as never,
    );

    await service.gerar('FIM_DIA');

    expect(registrarEventoNotificacao).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipo: 'RELATORIO_FIM_DIA_PEDIDOS', referenciaId: 'v1' }),
    );
  });

  it('erro ao registrar um vendedor nao interrompe o processamento dos demais', async () => {
    const relatorioPedidosService = relatorioPedidosServiceFake([
      vendedor({ vendedorId: 'falha', totalPedidos: 1 }),
      vendedor({ vendedorId: 'ok', totalPedidos: 1 }),
    ]);
    (registrarEventoNotificacao as jest.Mock)
      .mockRejectedValueOnce(new Error('erro de banco'))
      .mockResolvedValueOnce(undefined);
    const service = new RelatorioDiarioNotificacaoService(
      relatorioPedidosService as never,
      prismaFake() as never,
    );

    await expect(service.gerar('MANHA')).resolves.toBeUndefined();

    expect(registrarEventoNotificacao).toHaveBeenCalledTimes(2);
  });
});
