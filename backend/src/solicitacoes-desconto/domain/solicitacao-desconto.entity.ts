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

// O papel atende (>=) o papel exigido? - usado fora da entidade, ex: subir a
// cadeia de supervisores ate' o primeiro com alcada pra decidir.
export function papelAtendeExigido(papel: PapelVendedor, exigido: PapelVendedor): boolean {
  return NIVEL_PAPEL[papel] >= NIVEL_PAPEL[exigido];
}

export class SolicitacaoJaDecididaError extends Error {}
export class AutoaprovacaoNaoPermitidaError extends Error {}
export class NivelHierarquiaInsuficienteError extends Error {}
// Desconto pedido excede ate' o teto da alcada gerencial (o topo da
// hierarquia hoje) - ninguem no sistema tem alcada pra decidir isso,
// entao a criacao da SolicitacaoDesconto (e do pedido que a originou)
// falha alto em vez de gerar uma solicitacao que nenhum papel poderia
// aprovar (Epico 4, config-aba-aprovacao.jpg).
export class DescontoExcedeAlcadaMaximaError extends Error {}

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

// Config de alcada (ConfiguracaoDescontoService/ConfiguracaoDescontoDto) -
// duplicado aqui como interface de dominio pra `avaliar` nao depender do
// Prisma/service layer (DDD so' onde ha regra de negocio real, ver
// comentario no topo do arquivo).
export interface ConfiguracaoAlcadaAprovacao {
  limitePercentual: number;
  habilitarAprovacaoPorAlcada: boolean;
  percentualAlcadaGerencial: number;
  percentualAlcadaSupervisao: number;
}

export type ResultadoAvaliacaoAlcada =
  | { necessitaAprovacao: false }
  | { necessitaAprovacao: true; papelExigido: PapelVendedor };

export class SolicitacaoDesconto {
  constructor(private readonly props: SolicitacaoDescontoProps) {}

  get status(): StatusSolicitacaoDesconto {
    return this.props.status;
  }

  // Decisao unica de aprovacao (Epico 4, config-aba-aprovacao.jpg) -
  // substitui os antigos necessitaAprovacao()/calcularPapelExigido()
  // separados (o segundo so olhava o papel de quem pedia, nunca o
  // percentual - por isso nao dava pra ter 2 tetos distintos por alcada).
  //
  // habilitarAprovacaoPorAlcada=false: aprovacao desligada por completo,
  // decisao confirmada com o usuario (nao "volta pro limite unico", e'
  // "ninguem precisa aprovar nada").
  //
  // habilitarAprovacaoPorAlcada=true, 3 faixas por VALOR do desconto
  // (>, nao >=: exatamente no teto ainda e' liberado direto, mesmo
  // criterio de sempre):
  //   <= limitePercentual              -> sem aprovacao
  //   <= percentualAlcadaSupervisao    -> exige (pelo menos) SUPERVISOR
  //   <= percentualAlcadaGerencial     -> exige (pelo menos) GERENTE
  //   >  percentualAlcadaGerencial     -> bloqueado (DescontoExcedeAlcadaMaximaError)
  // O papel exigido final e' o MAIOR entre a faixa do percentual e "um
  // nivel acima de quem pediu" (mesma regra de auto-aprovacao de sempre:
  // um SUPERVISOR pedindo desconto dentro da propria alcada ainda escala
  // pra GERENTE, porque nao pode aprovar a propria solicitacao).
  static avaliar(
    percentualSolicitado: number,
    papelSolicitante: PapelVendedor,
    config: ConfiguracaoAlcadaAprovacao,
  ): ResultadoAvaliacaoAlcada {
    if (!config.habilitarAprovacaoPorAlcada) {
      return { necessitaAprovacao: false };
    }

    if (percentualSolicitado <= config.limitePercentual) {
      return { necessitaAprovacao: false };
    }

    if (percentualSolicitado > config.percentualAlcadaGerencial) {
      throw new DescontoExcedeAlcadaMaximaError(
        `Desconto de ${percentualSolicitado}% excede o teto da alcada gerencial (${config.percentualAlcadaGerencial}%) - nenhum papel no sistema pode aprovar este percentual`,
      );
    }

    const papelPorPercentual: PapelVendedor =
      percentualSolicitado <= config.percentualAlcadaSupervisao ? 'SUPERVISOR' : 'GERENTE';
    const papelAcimaSolicitante = SolicitacaoDesconto.calcularPapelExigido(papelSolicitante);

    const papelExigido: PapelVendedor =
      NIVEL_PAPEL[papelPorPercentual] >= NIVEL_PAPEL[papelAcimaSolicitante]
        ? papelPorPercentual
        : papelAcimaSolicitante;

    return { necessitaAprovacao: true, papelExigido };
  }

  // Um nivel acima de quem solicita. GERENTE e' o topo da hierarquia hoje
  // (Escopo desta OS: so VENDEDOR/SUPERVISOR/GERENTE, sem nivel acima de
  // GERENTE) - nesse caso o proprio papelExigido fica GERENTE, exigindo
  // OUTRO gerente pra decidir (autoaprovacao continua bloqueada por
  // validarDecisao, entao um GERENTE nunca aprova a propria solicitacao,
  // mesmo sem nivel acima dele). Usado tanto diretamente (fallback antigo,
  // ainda testado isoladamente) quanto como piso minimo dentro de
  // avaliar() acima.
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

  // Mesmas regras de validarDecisao, sem lancar - usado so pra decidir se a
  // UI deve oferecer os botoes de aceitar/recusar.
  podeSerDecididaPor(aprovador: AprovadorCandidato): boolean {
    try {
      this.validarDecisao(aprovador);
      return true;
    } catch {
      return false;
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
