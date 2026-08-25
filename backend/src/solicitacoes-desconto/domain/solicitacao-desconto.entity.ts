// Regra de negocio real (OS-BACKEND-22): decisao de quem pode
// aprovar/rejeitar uma solicitacao de desconto, com multiplos cenarios
// (autoaprovacao, nivel insuficiente, solicitacao ja decidida) - por isso
// vive numa entidade de dominio (ver skill nestjs, "DDD so onde ha regra
// de negocio real"), sem depender de Prisma/HTTP. O service so orquestra:
// busca os dados, instancia esta entidade, persiste o resultado.

export type PapelVendedor = 'VENDEDOR' | 'SUPERVISOR' | 'GERENTE';
export type StatusSolicitacaoDesconto = 'PENDENTE' | 'APROVADO' | 'REJEITADO';

// Ordem hierarquica - usada tanto pra calcular quem PODE aprovar
// (nivel >= papelExigido) quanto pra calcular o proximo nivel acima de
// quem solicita (calcularPapelExigido).
const NIVEL_PAPEL: Record<PapelVendedor, number> = {
  VENDEDOR: 0,
  SUPERVISOR: 1,
  GERENTE: 2,
};

export class SolicitacaoJaDecididaError extends Error {}
export class AutoaprovacaoNaoPermitidaError extends Error {}
export class NivelHierarquiaInsuficienteError extends Error {}

export interface AprovadorCandidato {
  id: string;
  papel: PapelVendedor;
}

export interface SolicitacaoDescontoProps {
  id: string;
  vendedorSolicitanteId: string;
  papelExigido: PapelVendedor;
  status: StatusSolicitacaoDesconto;
}

export class SolicitacaoDesconto {
  constructor(private readonly props: SolicitacaoDescontoProps) {}

  get status(): StatusSolicitacaoDesconto {
    return this.props.status;
  }

  // >, nao >= : desconto EXATAMENTE no limite ainda e' aplicado direto
  // (criterio de aceite: "ate 20%... acima de 20%").
  static necessitaAprovacao(
    percentualSolicitado: number,
    limitePercentual: number,
  ): boolean {
    return percentualSolicitado > limitePercentual;
  }

  // Um nivel acima de quem solicita. GERENTE e' o topo da hierarquia hoje
  // (Escopo desta OS: so VENDEDOR/SUPERVISOR/GERENTE, sem nivel acima de
  // GERENTE) - nesse caso o proprio papelExigido fica GERENTE, exigindo
  // OUTRO gerente pra decidir (autoaprovacao continua bloqueada por
  // validarDecisao, entao um GERENTE nunca aprova a propria solicitacao,
  // mesmo sem nivel acima dele).
  static calcularPapelExigido(papelSolicitante: PapelVendedor): PapelVendedor {
    if (papelSolicitante === 'VENDEDOR') {
      return 'SUPERVISOR';
    }
    return 'GERENTE';
  }

  private validarDecisao(aprovador: AprovadorCandidato): void {
    if (this.props.status !== 'PENDENTE') {
      throw new SolicitacaoJaDecididaError(
        `Solicitacao ${this.props.id} ja foi decidida (status atual: ${this.props.status})`,
      );
    }

    if (aprovador.id === this.props.vendedorSolicitanteId) {
      throw new AutoaprovacaoNaoPermitidaError(
        'Vendedor nao pode aprovar ou rejeitar a propria solicitacao de desconto',
      );
    }

    if (NIVEL_PAPEL[aprovador.papel] < NIVEL_PAPEL[this.props.papelExigido]) {
      throw new NivelHierarquiaInsuficienteError(
        `Papel '${aprovador.papel}' insuficiente para decidir esta solicitacao - exigido pelo menos '${this.props.papelExigido}'`,
      );
    }
  }

  aprovar(aprovador: AprovadorCandidato): StatusSolicitacaoDesconto {
    this.validarDecisao(aprovador);
    return 'APROVADO';
  }

  rejeitar(aprovador: AprovadorCandidato): StatusSolicitacaoDesconto {
    this.validarDecisao(aprovador);
    return 'REJEITADO';
  }
}
