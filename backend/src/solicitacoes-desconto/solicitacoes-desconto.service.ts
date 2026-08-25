import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PapelVendedor } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfiguracaoDescontoService } from './configuracao-desconto.service';
import {
  AutoaprovacaoNaoPermitidaError,
  NivelHierarquiaInsuficienteError,
  SolicitacaoDesconto,
  SolicitacaoJaDecididaError,
} from './domain/solicitacao-desconto.entity';
import type { StatusSolicitacaoDesconto } from './domain/solicitacao-desconto.entity';

export interface SolicitacaoDescontoDto {
  id: string;
  pedidoId: string | null;
  percentualSolicitado: number;
  vendedorSolicitanteId: string;
  papelExigido: PapelVendedor;
  aprovadorEsperadoId: string | null;
  status: StatusSolicitacaoDesconto;
  aprovadorId: string | null;
  decididoEm: string | null;
  criadoEm: string;
}

export type AvaliarDescontoResultado =
  | { necessitaAprovacao: false }
  | { necessitaAprovacao: true; solicitacao: SolicitacaoDescontoDto };

export interface AvaliarDescontoInput {
  vendedorSolicitanteId: string;
  pedidoId: string | null;
  percentualSolicitado: number;
}

// Orquestra a entidade de dominio (SolicitacaoDesconto, ver
// domain/solicitacao-desconto.entity.ts) com Prisma - a entidade decide,
// este service busca/persiste. Sem endpoint HTTP proprio pra
// avaliarDesconto() ainda (decisao confirmada com o usuario): quem vai
// chamar isso e' o fluxo de aplicar desconto num pedido, que so existe a
// partir da OS-BACKEND-25 (rascunho de pedido) - por enquanto e' um metodo
// de service testado isoladamente, pronto pra ser plugado quando esse
// fluxo existir.
@Injectable()
export class SolicitacoesDescontoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuracaoDescontoService: ConfiguracaoDescontoService,
  ) {}

  async avaliarDesconto(
    input: AvaliarDescontoInput,
  ): Promise<AvaliarDescontoResultado> {
    const limitePercentual =
      await this.configuracaoDescontoService.obterLimitePercentual();

    if (
      !SolicitacaoDesconto.necessitaAprovacao(
        input.percentualSolicitado,
        limitePercentual,
      )
    ) {
      return { necessitaAprovacao: false };
    }

    const solicitante = await this.prisma.vendedor.findUnique({
      where: { id: input.vendedorSolicitanteId },
    });
    if (!solicitante) {
      throw new NotFoundException(
        `Vendedor ${input.vendedorSolicitanteId} nao encontrado`,
      );
    }

    // Hierarquia e' configurada manualmente pelo admin (ver
    // vendedores/vendedores-hierarquia.service.ts) - sem supervisorId nao
    // ha pra quem endereçar a solicitacao, entao a criacao falha alto e
    // claro em vez de gravar uma solicitacao que nunca teria aprovador
    // (mesmo criterio fail-closed ja usado em WK_RADAR_*/ConfiguracaoLlm).
    if (!solicitante.supervisorId) {
      throw new UnprocessableEntityException(
        `Vendedor ${solicitante.id} sem hierarquia configurada - configure via PATCH /admin/vendedores/${solicitante.id}/hierarquia antes de solicitar desconto acima do limite`,
      );
    }

    const papelExigido = SolicitacaoDesconto.calcularPapelExigido(
      solicitante.papel,
    );

    const criada = await this.prisma.solicitacaoDesconto.create({
      data: {
        pedidoId: input.pedidoId,
        percentualSolicitado: input.percentualSolicitado,
        vendedorSolicitanteId: solicitante.id,
        papelExigido,
        aprovadorEsperadoId: solicitante.supervisorId,
      },
    });

    return { necessitaAprovacao: true, solicitacao: paraDto(criada) };
  }

  async aprovar(
    solicitacaoId: string,
    aprovadorUsuarioId: string,
  ): Promise<SolicitacaoDescontoDto> {
    return this.decidir(solicitacaoId, aprovadorUsuarioId, 'aprovar');
  }

  async rejeitar(
    solicitacaoId: string,
    aprovadorUsuarioId: string,
  ): Promise<SolicitacaoDescontoDto> {
    return this.decidir(solicitacaoId, aprovadorUsuarioId, 'rejeitar');
  }

  private async decidir(
    solicitacaoId: string,
    aprovadorUsuarioId: string,
    acao: 'aprovar' | 'rejeitar',
  ): Promise<SolicitacaoDescontoDto> {
    // usuarioId (JWT/sessao) -> Vendedor: so quem tem uma linha em Vendedor
    // vinculada ao proprio usuario pode decidir - mesmo raciocinio do
    // vinculo criado em VendedorSyncStrategy (OS-BACKEND-21).
    const aprovadorVendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId: aprovadorUsuarioId },
    });
    if (!aprovadorVendedor) {
      throw new ForbiddenException(
        'Usuario autenticado nao e um vendedor cadastrado - nao pode decidir solicitacoes de desconto',
      );
    }

    const registro = await this.prisma.solicitacaoDesconto.findUnique({
      where: { id: solicitacaoId },
    });
    if (!registro) {
      throw new NotFoundException(
        `Solicitacao de desconto ${solicitacaoId} nao encontrada`,
      );
    }

    const entidade = new SolicitacaoDesconto({
      id: registro.id,
      vendedorSolicitanteId: registro.vendedorSolicitanteId,
      papelExigido: registro.papelExigido,
      status: registro.status,
    });

    let novoStatus: StatusSolicitacaoDesconto;
    try {
      const aprovadorCandidato = {
        id: aprovadorVendedor.id,
        papel: aprovadorVendedor.papel,
      };
      novoStatus =
        acao === 'aprovar'
          ? entidade.aprovar(aprovadorCandidato)
          : entidade.rejeitar(aprovadorCandidato);
    } catch (error) {
      if (
        error instanceof AutoaprovacaoNaoPermitidaError ||
        error instanceof NivelHierarquiaInsuficienteError
      ) {
        throw new ForbiddenException(error.message);
      }
      if (error instanceof SolicitacaoJaDecididaError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    const atualizada = await this.prisma.solicitacaoDesconto.update({
      where: { id: registro.id },
      data: {
        status: novoStatus,
        aprovadorId: aprovadorVendedor.id,
        decididoEm: new Date(),
      },
    });

    return paraDto(atualizada);
  }
}

function paraDto(registro: {
  id: string;
  pedidoId: string | null;
  percentualSolicitado: { toNumber(): number };
  vendedorSolicitanteId: string;
  papelExigido: PapelVendedor;
  aprovadorEsperadoId: string | null;
  status: StatusSolicitacaoDesconto;
  aprovadorId: string | null;
  decididoEm: Date | null;
  criadoEm: Date;
}): SolicitacaoDescontoDto {
  return {
    id: registro.id,
    pedidoId: registro.pedidoId,
    percentualSolicitado: registro.percentualSolicitado.toNumber(),
    vendedorSolicitanteId: registro.vendedorSolicitanteId,
    papelExigido: registro.papelExigido,
    aprovadorEsperadoId: registro.aprovadorEsperadoId,
    status: registro.status,
    aprovadorId: registro.aprovadorId,
    decididoEm: registro.decididoEm ? registro.decididoEm.toISOString() : null,
    criadoEm: registro.criadoEm.toISOString(),
  };
}
