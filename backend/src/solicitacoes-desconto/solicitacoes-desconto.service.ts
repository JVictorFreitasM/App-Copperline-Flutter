import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { PapelVendedor, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
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

// Usado em GET /solicitacoes-desconto (OS-WEB-21) - inclui o solicitante e
// o pedido/cliente pra tela de aprovacao nao precisar de mais chamadas so
// pra mostrar contexto legivel (nome de quem pediu, cliente, valor).
export interface SolicitacaoDescontoResumoDto extends SolicitacaoDescontoDto {
  vendedorSolicitante: { id: string; nome: string | null };
  pedido: {
    id: string;
    valorTotal: string | null;
    cliente: { id: string; razaoSocial: string | null } | null;
  } | null;
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
    private readonly vendedorEscopoService: VendedorEscopoService,
  ) {}

  // Lista PENDENTE escopada por hierarquia (OS-WEB-21, mesma resolucao de
  // papel/equipe de VendedorEscopoService, ver seu comentario sobre reuso
  // alem de Cliente): SUPERVISOR/GERENTE ve a propria equipe (recursivo,
  // ja inclusa a propria carteira); admin do IdP ve tudo; VENDEDOR comum
  // (sem papel de aprovacao) ou usuario sem Vendedor vinculado nao tem
  // "equipe" nenhuma pra aprovar - 403, nao lista vazia (a tela usa esse
  // 403 pra mostrar "sem permissao de aprovacao" em vez de assumir acesso).
  async listarPendentes(
    idpUser: IdpUser,
    usuarioId: string,
  ): Promise<SolicitacaoDescontoResumoDto[]> {
    const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
      idpUser,
      usuarioId,
    );

    if (escopo.tipo === 'NENHUM' || escopo.tipo === 'PROPRIO') {
      throw new ForbiddenException(
        'Usuario autenticado nao tem papel de aprovacao (supervisor/gerente) - sem solicitacoes de equipe para listar',
      );
    }

    const where: Prisma.SolicitacaoDescontoWhereInput = {
      status: 'PENDENTE',
      ...(escopo.tipo === 'EQUIPE'
        ? { vendedorSolicitanteId: { in: escopo.vendedorIds } }
        : {}),
    };

    const registros = await this.prisma.solicitacaoDesconto.findMany({
      where,
      orderBy: { criadoEm: 'asc' },
      include: {
        vendedorSolicitante: { select: { id: true, nome: true } },
        pedido: {
          select: {
            id: true,
            valorTotal: true,
            cliente: { select: { id: true, razaoSocial: true } },
          },
        },
      },
    });

    return registros.map(paraResumoDto);
  }

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

    const atualizada = await this.prisma.$transaction(async (tx) => {
      const resultado = await tx.solicitacaoDesconto.update({
        where: { id: registro.id },
        data: {
          status: novoStatus,
          aprovadorId: aprovadorVendedor.id,
          decididoEm: new Date(),
        },
      });

      // Historico do PEDIDO (OS-BACKEND-33), nao so da solicitacao - so
      // registra quando ja existe um pedido vinculado (pedidoId comeca
      // null, so e' preenchido por persistirPedidoAguardandoAprovacao - ver
      // criar-pedido.service.ts; teoricamente sempre preenchido por aqui,
      // mas defensivo contra a ordem de chamada mudar no futuro).
      if (resultado.pedidoId) {
        await tx.pedidoHistoricoStatus.create({
          data: {
            pedidoId: resultado.pedidoId,
            statusAnterior: 'AGUARDANDO_APROVACAO',
            statusNovo: novoStatus,
            alteradoPor: aprovadorUsuarioId,
          },
        });
      }

      return resultado;
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

function paraResumoDto(registro: {
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
  vendedorSolicitante: { id: string; nome: string | null };
  pedido: {
    id: string;
    valorTotal: { toString(): string } | null;
    cliente: { id: string; razaoSocial: string | null } | null;
  } | null;
}): SolicitacaoDescontoResumoDto {
  return {
    ...paraDto(registro),
    vendedorSolicitante: registro.vendedorSolicitante,
    pedido: registro.pedido
      ? {
          id: registro.pedido.id,
          valorTotal: registro.pedido.valorTotal ? registro.pedido.valorTotal.toString() : null,
          cliente: registro.pedido.cliente,
        }
      : null,
  };
}
