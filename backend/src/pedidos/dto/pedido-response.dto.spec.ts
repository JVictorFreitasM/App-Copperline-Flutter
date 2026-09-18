import { calcularStatusAprovacaoPedido } from './pedido-response.dto';

describe('calcularStatusAprovacaoPedido', () => {
  it('ORCAMENTO tem prioridade sobre idExternoErp null (Epico 4)', () => {
    expect(
      calcularStatusAprovacaoPedido({ statusLocal: 'ORCAMENTO', idExternoErp: null }),
    ).toBe('ORCAMENTO');
  });

  it('AGUARDANDO_APROVACAO tem prioridade sobre idExternoErp null', () => {
    expect(
      calcularStatusAprovacaoPedido({ statusLocal: 'AGUARDANDO_APROVACAO', idExternoErp: null }),
    ).toBe('AGUARDANDO_APROVACAO');
  });

  it('ENVIADO quando statusLocal e ENVIADO', () => {
    expect(
      calcularStatusAprovacaoPedido({ statusLocal: 'ENVIADO', idExternoErp: null }),
    ).toBe('ENVIADO');
  });

  it('ENVIADO quando idExternoErp preenchido (pedido sincronizado do Radar, sem statusLocal)', () => {
    expect(
      calcularStatusAprovacaoPedido({ statusLocal: null, idExternoErp: 'erp-123' }),
    ).toBe('ENVIADO');
  });

  it('NAO_INTEGRADO quando nao ha idExternoErp nem statusLocal reconhecido', () => {
    expect(calcularStatusAprovacaoPedido({ statusLocal: null, idExternoErp: null })).toBe(
      'NAO_INTEGRADO',
    );
  });
});
