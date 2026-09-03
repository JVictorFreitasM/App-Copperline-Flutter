import { montarFunilPedidos } from './montar-funil-pedidos';

describe('montarFunilPedidos', () => {
  it('agrupa as situacoes reais em etapas do funil, com cancelados/bloqueados a parte', () => {
    const resultado = montarFunilPedidos([
      { situacao: 'EM_ANALISE', quantidade: 3 },
      { situacao: 'PENDENTE', quantidade: 2 },
      { situacao: 'PARCIALMENTE_ATENDIDO', quantidade: 4 },
      { situacao: 'PARCIALMENTE_FATURADO', quantidade: 1 },
      { situacao: 'ATENDIDO', quantidade: 5 },
      { situacao: 'FATURADO', quantidade: 10 },
      { situacao: 'CANCELADO', quantidade: 2 },
      { situacao: 'BLOQUEADO', quantidade: 1 },
    ]);

    expect(resultado.etapas).toEqual([
      { etapa: 'Criado', quantidade: 28 },
      { etapa: 'Em processamento', quantidade: 5 },
      { etapa: 'Atendimento parcial', quantidade: 5 },
      { etapa: 'Concluído', quantidade: 15 },
    ]);
    expect(resultado.cancelados).toBe(2);
    expect(resultado.bloqueados).toBe(1);
  });

  it('retorna tudo zerado quando nao ha nenhum pedido no periodo', () => {
    const resultado = montarFunilPedidos([]);

    expect(resultado.etapas).toEqual([
      { etapa: 'Criado', quantidade: 0 },
      { etapa: 'Em processamento', quantidade: 0 },
      { etapa: 'Atendimento parcial', quantidade: 0 },
      { etapa: 'Concluído', quantidade: 0 },
    ]);
    expect(resultado.cancelados).toBe(0);
    expect(resultado.bloqueados).toBe(0);
  });

  it('"Criado" conta o total mesmo incluindo cancelados/bloqueados (todos foram criados)', () => {
    const resultado = montarFunilPedidos([
      { situacao: 'CANCELADO', quantidade: 3 },
      { situacao: 'ATENDIDO', quantidade: 2 },
    ]);

    expect(resultado.etapas[0]).toEqual({ etapa: 'Criado', quantidade: 5 });
  });
});
