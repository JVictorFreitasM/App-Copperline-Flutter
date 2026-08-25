import {
  AutoaprovacaoNaoPermitidaError,
  NivelHierarquiaInsuficienteError,
  SolicitacaoDesconto,
  SolicitacaoJaDecididaError,
} from './solicitacao-desconto.entity';

describe('SolicitacaoDesconto.necessitaAprovacao', () => {
  it('nao necessita aprovacao quando o percentual e igual ao limite', () => {
    expect(SolicitacaoDesconto.necessitaAprovacao(20, 20)).toBe(false);
  });

  it('nao necessita aprovacao quando o percentual esta abaixo do limite', () => {
    expect(SolicitacaoDesconto.necessitaAprovacao(15, 20)).toBe(false);
  });

  it('necessita aprovacao quando o percentual esta acima do limite', () => {
    expect(SolicitacaoDesconto.necessitaAprovacao(20.01, 20)).toBe(true);
  });
});

describe('SolicitacaoDesconto.calcularPapelExigido', () => {
  it('vendedor exige supervisor', () => {
    expect(SolicitacaoDesconto.calcularPapelExigido('VENDEDOR')).toBe('SUPERVISOR');
  });

  it('supervisor exige gerente', () => {
    expect(SolicitacaoDesconto.calcularPapelExigido('SUPERVISOR')).toBe('GERENTE');
  });

  it('gerente (topo da hierarquia) exige outro gerente', () => {
    expect(SolicitacaoDesconto.calcularPapelExigido('GERENTE')).toBe('GERENTE');
  });
});

describe('SolicitacaoDesconto.aprovar/rejeitar', () => {
  function criar(status: 'PENDENTE' | 'APROVADO' | 'REJEITADO' = 'PENDENTE') {
    return new SolicitacaoDesconto({
      id: 's1',
      vendedorSolicitanteId: 'vendedor-1',
      papelExigido: 'SUPERVISOR',
      status,
    });
  }

  it('aprova quando o aprovador tem papel igual ao exigido e nao e o solicitante', () => {
    const solicitacao = criar();
    expect(solicitacao.aprovar({ id: 'supervisor-1', papel: 'SUPERVISOR' })).toBe('APROVADO');
  });

  it('aprova quando o aprovador tem papel ACIMA do exigido', () => {
    const solicitacao = criar();
    expect(solicitacao.aprovar({ id: 'gerente-1', papel: 'GERENTE' })).toBe('APROVADO');
  });

  it('rejeita normalmente quando autorizado', () => {
    const solicitacao = criar();
    expect(solicitacao.rejeitar({ id: 'supervisor-1', papel: 'SUPERVISOR' })).toBe('REJEITADO');
  });

  it('nao permite o proprio solicitante aprovar (autoaprovacao)', () => {
    const solicitacao = criar();
    expect(() =>
      solicitacao.aprovar({ id: 'vendedor-1', papel: 'GERENTE' }),
    ).toThrow(AutoaprovacaoNaoPermitidaError);
  });

  it('nao permite decidir com papel abaixo do exigido (ex: outro vendedor no mesmo nivel)', () => {
    const solicitacao = criar();
    expect(() =>
      solicitacao.aprovar({ id: 'vendedor-2', papel: 'VENDEDOR' }),
    ).toThrow(NivelHierarquiaInsuficienteError);
  });

  it('nao permite decidir uma solicitacao ja aprovada', () => {
    const solicitacao = criar('APROVADO');
    expect(() =>
      solicitacao.aprovar({ id: 'supervisor-1', papel: 'SUPERVISOR' }),
    ).toThrow(SolicitacaoJaDecididaError);
  });

  it('nao permite decidir uma solicitacao ja rejeitada', () => {
    const solicitacao = criar('REJEITADO');
    expect(() =>
      solicitacao.rejeitar({ id: 'supervisor-1', papel: 'SUPERVISOR' }),
    ).toThrow(SolicitacaoJaDecididaError);
  });
});
