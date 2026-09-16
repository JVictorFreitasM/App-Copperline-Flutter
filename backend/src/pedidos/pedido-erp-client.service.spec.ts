import { PedidoErpClientService } from './pedido-erp-client.service';

function configServiceFake(overrides: Record<string, string> = {}) {
  const valores: Record<string, string> = {
    WK_RADAR_ID_FILIAL: '16384',
    WK_RADAR_ID_UNIDADE_VENDA: '229376',
    ...overrides,
  };
  return {
    getOrThrow: jest.fn((chave: string) => {
      const valor = valores[chave];
      if (valor === undefined) {
        throw new Error(`Configuração '${chave}' não encontrada`);
      }
      return valor;
    }),
  };
}

const INPUT_BASE = {
  clienteIdExterno: 'cliente-externo-1',
  vendedorIdExterno: 'vendedor-externo-1',
  idCondicaoPagamento: 'condicao-externo-1',
  percentualDesconto: 10,
  itens: [
    {
      produtoIdExterno: 'produto-externo-1',
      idTabelaPreco: 'tabela-externo-1',
      quantidade: 3,
      valorUnitario: 30,
    },
  ],
  parcelas: [
    {
      idFormaPagamento: 'forma-externo-1',
      dataVencimento: new Date(Date.UTC(2026, 9, 16)),
      valor: 81,
    },
  ],
};

describe('PedidoErpClientService.criar', () => {
  it('monta o payload confirmado (POST /comercial/v1/pedido) e devolve id/codigoIntegrador do primeiro item da resposta', async () => {
    const post = jest
      .fn()
      .mockResolvedValue([{ id: 'erp-123', codigoIntegrador: 'pedido-1' }]);
    const erpClient = { post } as never;
    const service = new PedidoErpClientService(erpClient, configServiceFake() as never);

    const resultado = await service.criar(INPUT_BASE);

    expect(post).toHaveBeenCalledWith(
      '/comercial/v1/pedido',
      [
        expect.objectContaining({
          idFilial: '16384',
          idCliente: 'cliente-externo-1',
          vendedores: [{ id: 'vendedor-externo-1' }],
          itens: [
            expect.objectContaining({
              produtoServico: { tipo: 'Produto', id: 'produto-externo-1' },
              idTabelaPreco: 'tabela-externo-1',
              idUnidadeVenda: '229376',
              quantidadeVenda: 3,
              valorUnitario: 30,
            }),
          ],
          total: {
            percentualDescontoProdutos: 10,
            descontoProdutosEmPercentual: true,
          },
          faturamento: expect.objectContaining({
            idCondicaoPagamento: 'condicao-externo-1',
            parcelas: [
              expect.objectContaining({
                idFormaPagamento: 'forma-externo-1',
                dataVencimento: '2026-10-16',
                valor: 81,
              }),
            ],
          }),
        }),
      ],
    );
    expect(resultado).toEqual({ idExterno: 'erp-123', codigoIntegrador: 'pedido-1' });
  });

  it('nunca inclui idOperacaoComercial/idClassificacao/idNaturezaOperacao no payload (confirmado com o usuario - preenchidos pelo faturamento depois)', async () => {
    const post = jest.fn().mockResolvedValue([{ id: 'erp-1', codigoIntegrador: 'ped-1' }]);
    const erpClient = { post } as never;
    const service = new PedidoErpClientService(erpClient, configServiceFake() as never);

    await service.criar(INPUT_BASE);

    const [, corpo] = post.mock.calls[0];
    const pedido = (corpo as Record<string, unknown>[])[0];
    expect(pedido).not.toHaveProperty('idOperacaoComercial');
    expect(pedido).not.toHaveProperty('idClassificacao');
    expect(pedido).not.toHaveProperty('idNaturezaOperacaoProduto');
  });

  it('lanca erro quando o Radar responde uma lista vazia (nenhum pedido criado)', async () => {
    const post = jest.fn().mockResolvedValue([]);
    const erpClient = { post } as never;
    const service = new PedidoErpClientService(erpClient, configServiceFake() as never);

    await expect(service.criar(INPUT_BASE)).rejects.toThrow(/nenhum pedido criado/i);
  });

  it('codigoIntegrador vira string vazia (nunca null) quando o Radar nao devolve nenhum', async () => {
    const post = jest.fn().mockResolvedValue([{ id: 'erp-1', codigoIntegrador: null }]);
    const erpClient = { post } as never;
    const service = new PedidoErpClientService(erpClient, configServiceFake() as never);

    const resultado = await service.criar(INPUT_BASE);

    expect(resultado.codigoIntegrador).toBe('');
  });
});
