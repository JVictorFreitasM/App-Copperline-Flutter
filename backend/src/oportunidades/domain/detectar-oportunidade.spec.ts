import {
  detectarAniversarioRelacionamento,
  detectarRecompraProxima,
  detectarSemPedidoHaDias,
} from './detectar-oportunidade';

describe('detectarSemPedidoHaDias', () => {
  it('retorna null quando nunca houve pedido', () => {
    expect(detectarSemPedidoHaDias(null, new Date('2026-06-01'), 30)).toBeNull();
  });

  it('retorna null quando o ultimo pedido esta dentro do limiar', () => {
    const resultado = detectarSemPedidoHaDias(
      new Date('2026-05-15'),
      new Date('2026-06-01'),
      30,
    );
    expect(resultado).toBeNull();
  });

  it('retorna o motivo quando o ultimo pedido excede o limiar', () => {
    const resultado = detectarSemPedidoHaDias(
      new Date('2026-04-01'),
      new Date('2026-06-01'),
      30,
    );
    expect(resultado).toEqual({ tipo: 'SEM_PEDIDO_HA_DIAS', dias: 61 });
  });
});

describe('detectarAniversarioRelacionamento', () => {
  it('retorna null quando nunca houve pedido', () => {
    expect(detectarAniversarioRelacionamento(null, new Date('2026-06-01'))).toBeNull();
  });

  it('retorna null no primeiro ano (menos de 1 ano de relacionamento)', () => {
    const resultado = detectarAniversarioRelacionamento(
      new Date('2026-01-10'),
      new Date('2026-01-11'),
    );
    expect(resultado).toBeNull();
  });

  it('retorna o motivo quando hoje esta dentro da janela do aniversario', () => {
    const resultado = detectarAniversarioRelacionamento(
      new Date('2024-06-10'),
      new Date('2026-06-11'),
      3,
    );
    expect(resultado).toEqual({ tipo: 'ANIVERSARIO_RELACIONAMENTO', anos: 2 });
  });

  it('retorna o motivo mesmo na virada de ano (aniversario em dezembro, hoje em janeiro)', () => {
    const resultado = detectarAniversarioRelacionamento(
      new Date('2024-12-30'),
      new Date('2026-01-01'),
      3,
    );
    expect(resultado).toEqual({ tipo: 'ANIVERSARIO_RELACIONAMENTO', anos: 1 });
  });

  it('retorna null quando hoje esta fora da janela do aniversario', () => {
    const resultado = detectarAniversarioRelacionamento(
      new Date('2024-06-10'),
      new Date('2026-09-01'),
      3,
    );
    expect(resultado).toBeNull();
  });
});

describe('detectarRecompraProxima', () => {
  it('retorna null quando o produto so foi comprado uma vez (sem intervalo pra estimar)', () => {
    const resultado = detectarRecompraProxima(
      [{ produtoId: 'p1', data: new Date('2026-05-01') }],
      new Date('2026-06-15'),
    );
    expect(resultado).toBeNull();
  });

  it('retorna o motivo quando o tempo desde a ultima compra esta dentro da tolerancia do intervalo medio', () => {
    // Compras de 45 em 45 dias - ultima compra ha 50 dias (dentro de 80%-130% de 45).
    const resultado = detectarRecompraProxima(
      [
        { produtoId: 'p1', data: new Date('2026-01-01') },
        { produtoId: 'p1', data: new Date('2026-02-15') },
      ],
      new Date('2026-04-06'),
    );
    expect(resultado).toEqual({
      tipo: 'RECOMPRA_PROXIMA',
      produtoId: 'p1',
      intervaloMedioDias: 45,
      diasDesdeUltimaCompra: 50,
    });
  });

  it('retorna null quando ainda esta muito longe do intervalo esperado', () => {
    const resultado = detectarRecompraProxima(
      [
        { produtoId: 'p1', data: new Date('2026-01-01') },
        { produtoId: 'p1', data: new Date('2026-02-15') },
      ],
      new Date('2026-02-20'),
    );
    expect(resultado).toBeNull();
  });

  it('retorna null quando ja passou muito do intervalo esperado (nao e mais "proximo")', () => {
    const resultado = detectarRecompraProxima(
      [
        { produtoId: 'p1', data: new Date('2026-01-01') },
        { produtoId: 'p1', data: new Date('2026-02-15') },
      ],
      new Date('2026-06-01'),
    );
    expect(resultado).toBeNull();
  });
});
