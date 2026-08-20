import { PedidoSyncStrategy } from './pedido.sync';
import type { WkRadarPedido } from './pedido.types';

describe('PedidoSyncStrategy.map', () => {
  const configServiceFake = { get: () => undefined } as never;
  const strategy = new PedidoSyncStrategy(
    undefined as never,
    undefined as never,
    configServiceFake,
  );

  it('mapeia os campos-chave, traduz o enum situacao e usa null para ausentes', () => {
    const bruto: WkRadarPedido = {
      id: '789',
      codigoIntegrador: null,
      numero: 'PED-1',
      situacao: 'Faturado',
      dataHoraUltimaAlteracao: '2026-08-18T10:00:00',
      idCliente: 'cliente-123',
      total: { valorTotal: 150.5 },
      itens: [],
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado).toEqual({
      idExternoErp: '789',
      codigoIntegrador: null,
      numero: 'PED-1',
      situacao: 'FATURADO',
      dataHoraUltimaAlteracao: new Date('2026-08-18T10:00:00'),
      idClienteExterno: 'cliente-123',
      valorTotal: 150.5,
      itens: [],
    });
  });

  it('mapeia itens preservando a combinacao produto id + grade (nao so o id)', () => {
    const bruto: WkRadarPedido = {
      id: '789',
      itens: [
        {
          numero: 1,
          produtoServico: {
            id: 'produto-1',
            idItemGrade1: 'cor-azul',
            idItemGrade2: 'tam-m',
          },
          quantidadeVenda: 2,
          valorUnitario: 10,
          valorTotal: 20,
          situacao: 'Pendente',
        },
      ],
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.itens).toEqual([
      {
        numero: 1,
        produtoServicoId: 'produto-1',
        idItemGrade1: 'cor-azul',
        idItemGrade2: 'tam-m',
        idItemGrade3: null,
        quantidadeVenda: 2,
        valorUnitario: 10,
        valorTotal: 20,
        situacao: 'PENDENTE',
      },
    ]);
  });

  it('trata pedido sem cliente/itens sem produto (referencia ausente) sem lancar', () => {
    const bruto: WkRadarPedido = {
      id: '789',
      idCliente: null,
      itens: [{ numero: 1, produtoServico: null }],
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.idClienteExterno).toBeNull();
    expect(mapeado.itens[0].produtoServicoId).toBeNull();
  });
});
