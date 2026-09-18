import {
  AutoaprovacaoNaoPermitidaError,
  DescontoExcedeAlcadaMaximaError,
  NivelHierarquiaInsuficienteError,
  SolicitacaoDesconto,
  SolicitacaoJaDecididaError,
} from './solicitacao-desconto.entity';
import type { ConfiguracaoAlcadaAprovacao } from './solicitacao-desconto.entity';

const CONFIG_PADRAO: ConfiguracaoAlcadaAprovacao = {
  limitePercentual: 20,
  habilitarAprovacaoPorAlcada: true,
  percentualAlcadaSupervisao: 30,
  percentualAlcadaGerencial: 50,
};

describe('SolicitacaoDesconto.avaliar', () => {
  it('nao necessita aprovacao quando o percentual e igual ao limite do vendedor', () => {
    expect(SolicitacaoDesconto.avaliar(20, 'VENDEDOR', CONFIG_PADRAO)).toEqual({
      necessitaAprovacao: false,
    });
  });

  it('nao necessita aprovacao quando o percentual esta abaixo do limite', () => {
    expect(SolicitacaoDesconto.avaliar(15, 'VENDEDOR', CONFIG_PADRAO)).toEqual({
      necessitaAprovacao: false,
    });
  });

  it('vendedor pedindo dentro da alcada de supervisao exige SUPERVISOR', () => {
    expect(SolicitacaoDesconto.avaliar(25, 'VENDEDOR', CONFIG_PADRAO)).toEqual({
      necessitaAprovacao: true,
      papelExigido: 'SUPERVISOR',
    });
  });

  it('exatamente no teto da alcada de supervisao ainda exige so SUPERVISOR', () => {
    expect(SolicitacaoDesconto.avaliar(30, 'VENDEDOR', CONFIG_PADRAO)).toEqual({
      necessitaAprovacao: true,
      papelExigido: 'SUPERVISOR',
    });
  });

  it('vendedor pedindo acima da alcada de supervisao exige GERENTE', () => {
    expect(SolicitacaoDesconto.avaliar(35, 'VENDEDOR', CONFIG_PADRAO)).toEqual({
      necessitaAprovacao: true,
      papelExigido: 'GERENTE',
    });
  });

  it('exatamente no teto da alcada gerencial ainda e permitido (exige GERENTE)', () => {
    expect(SolicitacaoDesconto.avaliar(50, 'VENDEDOR', CONFIG_PADRAO)).toEqual({
      necessitaAprovacao: true,
      papelExigido: 'GERENTE',
    });
  });

  it('acima do teto da alcada gerencial e bloqueado', () => {
    expect(() => SolicitacaoDesconto.avaliar(50.01, 'VENDEDOR', CONFIG_PADRAO)).toThrow(
      DescontoExcedeAlcadaMaximaError,
    );
  });

  it('supervisor pedindo dentro da propria alcada ainda escala pra GERENTE (nao pode auto-aprovar)', () => {
    expect(SolicitacaoDesconto.avaliar(25, 'SUPERVISOR', CONFIG_PADRAO)).toEqual({
      necessitaAprovacao: true,
      papelExigido: 'GERENTE',
    });
  });

  it('toggle desligado: nunca necessita aprovacao, nao importa o percentual', () => {
    const config: ConfiguracaoAlcadaAprovacao = {
      ...CONFIG_PADRAO,
      habilitarAprovacaoPorAlcada: false,
    };
    expect(SolicitacaoDesconto.avaliar(90, 'VENDEDOR', config)).toEqual({
      necessitaAprovacao: false,
    });
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
