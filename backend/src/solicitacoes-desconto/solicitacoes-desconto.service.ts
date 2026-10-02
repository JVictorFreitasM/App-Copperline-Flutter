import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { PapelVendedor, Prisma } from '../../generated/prisma/client';
import { registrarEventoNotificacao } from '../notificacoes/evento-notificacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { ConfiguracaoDescontoService } from './configuracao-desconto.service';
import type { ConfiguracaoDescontoDto } from './configuracao-desconto.service';
import {
  AutoaprovacaoNaoPermitidaError,
  DescontoExcedeAlcadaMaximaError,
  NivelHierarquiaInsuficienteError,
  papelAtendeExigido,
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
  // true so' quando o usuario logado tem a alcada exigida e nao e' o
  // solicitante - a tela de Aprovacoes desabilita os botoes quando false.
  podeDecidir: boolean;
  pedido: {
    id: string;
    valorTotal: string | null;
    cliente: { id: string; razaoSocial: string | null } | null;
  } | null;
}

export type { SolicitacaoDescontoDoPedidoDto } from '../pedidos/dto/pedido-response.dto';
import type { SolicitacaoDescontoDoPedidoDto } from '../pedidos/dto/pedido-response.dto';

export type AvaliarDescontoResultado =
  | { necessitaAprovacao: false }
  | { necessitaAprovacao: true; solicitacao: SolicitacaoDescontoDto };

export interface AvaliarDescontoInput {
  vendedorSolicitanteId: string;
  pedidoId: string | null;
  percentualSolicitado: number;
}

// OS-BACKEND-22-A - resultado da SIMULACAO (POST /pedidos/simular-desconto):
// mesma decisao de avaliarDesconto(), mas sem pedidoId (simulacao nao tem
// pedido ainda) e sem SolicitacaoDescontoDto (nada foi persistido) - so o
// aprovador esperado, pra a tela mostrar "vai para fulano" antes de
// confirmar.
export type SimularDescontoResultado =
  | { necessitaAprovacao: false }
  | {
      necessitaAprovacao: true;
      aprovadorEsperado: { id: string; nome: string | null };
    };

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

    // Quem pode decidir CADA solicitacao (a lista mostra tudo da equipe, mas um
    // supervisor nao decide o que exige gerente) - a tela desabilita o botao.
    const logado = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
      select: { id: true, papel: true },
    });
    return registros.map((registro) =>
      paraResumoDto(registro, {
        podeDecidir:
          logado !== null &&
          new SolicitacaoDesconto({
            id: registro.id,
            vendedorSolicitanteId: registro.vendedorSolicitanteId,
            papelExigido: registro.papelExigido,
            status: registro.status,
          }).podeSerDecididaPor({ id: logado.id, papel: logado.papel }),
      }),
    );
  }

  async avaliarDesconto(
    input: AvaliarDescontoInput,
  ): Promise<AvaliarDescontoResultado> {
    const config = await this.configuracaoDescontoService.obter();

    const solicitante = await this.prisma.vendedor.findUnique({
      where: { id: input.vendedorSolicitanteId },
    });
    if (!solicitante) {
      throw new NotFoundException(
        `Vendedor ${input.vendedorSolicitanteId} nao encontrado`,
      );
    }

    const avaliacao = avaliarComTratamento(
      input.percentualSolicitado,
      solicitante.papel,
      config,
    );
    if (!avaliacao.necessitaAprovacao) {
      return { necessitaAprovacao: false };
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

    const papelExigido = avaliacao.papelExigido;
    const aprovadorEsperado = await this.resolverAprovadorEsperado(
      solicitante.supervisorId,
      papelExigido,
    );

    const criada = await this.prisma.$transaction(async (tx) => {
      const registro = await tx.solicitacaoDesconto.create({
        data: {
          pedidoId: input.pedidoId,
          percentualSolicitado: input.percentualSolicitado,
          vendedorSolicitanteId: solicitante.id,
          papelExigido,
          // Quem tem a ALCADA exigida (nao necessariamente o supervisor
          // direto): desconto de gerente notifica o gerente.
          aprovadorEsperadoId: aprovadorEsperado?.id ?? solicitante.supervisorId,
        },
      });

      await registrarEventoNotificacao(tx, {
        tipo: 'SOLICITACAO_DESCONTO_CRIADA',
        referenciaId: registro.id,
        titulo: 'Desconto pendente de aprovação',
        corpo: `${solicitante.nome ?? 'Um vendedor'} solicitou ${input.percentualSolicitado}% de desconto - aguardando sua decisão.`,
        // Pedido do usuario (2026-10-02): tocar na notificacao leva ao
        // PEDIDO (nao a lista de Aprovacoes). Quando o pedido ja existe
        // (orcamento transformado em pedido) o pedidoId entra aqui; no fluxo
        // normal o pedido so' e' criado logo depois, e
        // CriarPedidoService.persistirPedidoAguardandoAprovacao completa o
        // payload deste evento com o pedidoId.
        dados: {
          solicitacaoId: registro.id,
          ...(input.pedidoId && { pedidoId: input.pedidoId }),
        },
      });

      return registro;
    });

    return { necessitaAprovacao: true, solicitacao: paraDto(criada) };
  }

  // OS-BACKEND-22-A - mesma decisao de avaliarDesconto() (limite, hierarquia
  // do solicitante), mas PURA: nunca cria SolicitacaoDesconto nem dispara
  // notificacao. Usada por POST /pedidos/simular-desconto, chamada em tempo
  // real enquanto o vendedor ainda esta montando o pedido (antes de existir
  // um pedidoId de verdade pra vincular).
  async simular(input: {
    vendedorSolicitanteId: string;
    percentualSolicitado: number;
  }): Promise<SimularDescontoResultado> {
    const config = await this.configuracaoDescontoService.obter();

    const solicitante = await this.prisma.vendedor.findUnique({
      where: { id: input.vendedorSolicitanteId },
      include: { supervisor: { select: { id: true, nome: true } } },
    });
    if (!solicitante) {
      throw new NotFoundException(
        `Vendedor ${input.vendedorSolicitanteId} nao encontrado`,
      );
    }

    const avaliacao = avaliarComTratamento(
      input.percentualSolicitado,
      solicitante.papel,
      config,
    );
    if (!avaliacao.necessitaAprovacao) {
      return { necessitaAprovacao: false };
    }

    if (!solicitante.supervisorId || !solicitante.supervisor) {
      throw new UnprocessableEntityException(
        `Vendedor ${solicitante.id} sem hierarquia configurada - configure via PATCH /admin/vendedores/${solicitante.id}/hierarquia antes de solicitar desconto acima do limite`,
      );
    }

    const aprovador = await this.resolverAprovadorEsperado(
      solicitante.supervisorId,
      avaliacao.papelExigido,
    );
    return {
      necessitaAprovacao: true,
      aprovadorEsperado: {
        id: aprovador?.id ?? solicitante.supervisor.id,
        nome: aprovador ? aprovador.nome : solicitante.supervisor.nome,
      },
    };
  }

  // Sobe a cadeia de supervisores a partir do supervisor direto ate' o
  // PRIMEIRO com papel >= papelExigido - e' ele quem deve decidir (e ser
  // notificado). Regra do negocio: se um item cai na alcada do gerente, o
  // gerente decide o desconto de TODOS os itens (papelExigido ja e' o maior
  // entre os itens). Sem ninguem com essa alcada na cadeia, cai no supervisor
  // direto (comportamento anterior) - qualquer gerente do escopo ainda ve e
  // decide a solicitacao na lista de Aprovacoes.
  private async resolverAprovadorEsperado(
    supervisorDiretoId: string | null,
    papelExigido: PapelVendedor,
  ): Promise<{ id: string; nome: string | null } | null> {
    let atualId = supervisorDiretoId;
    let primeiro: { id: string; nome: string | null } | null = null;
    const visitados = new Set<string>();

    while (atualId && !visitados.has(atualId) && visitados.size < 10) {
      visitados.add(atualId);
      const vendedor = await this.prisma.vendedor.findUnique({
        where: { id: atualId },
        select: { id: true, nome: true, papel: true, supervisorId: true },
      });
      if (!vendedor) break;
      primeiro ??= { id: vendedor.id, nome: vendedor.nome };
      if (papelAtendeExigido(vendedor.papel, papelExigido)) {
        return { id: vendedor.id, nome: vendedor.nome };
      }
      atualId = vendedor.supervisorId;
    }
    return primeiro;
  }

  async obterDto(solicitacaoId: string): Promise<SolicitacaoDescontoDto> {
    const registro = await this.prisma.solicitacaoDesconto.findUnique({
      where: { id: solicitacaoId },
    });
    if (!registro) {
      throw new NotFoundException(`Solicitacao de desconto ${solicitacaoId} nao encontrada`);
    }
    return paraDto(registro);
  }

  // true quando UM item com este percentual de desconto precisa de
  // aprovacao (acima da alcada do solicitante) - decisao por ITEM, usada pra
  // marcar quais itens do pedido ficam PENDENTES e quais ja nascem aceitos.
  async exigeAprovacao(vendedorSolicitanteId: string, percentual: number): Promise<boolean> {
    const config = await this.configuracaoDescontoService.obter();
    const solicitante = await this.prisma.vendedor.findUnique({
      where: { id: vendedorSolicitanteId },
      select: { papel: true },
    });
    if (!solicitante) {
      throw new NotFoundException(`Vendedor ${vendedorSolicitanteId} nao encontrado`);
    }
    return avaliarComTratamento(percentual, solicitante.papel, config).necessitaAprovacao;
  }

  // Valida (sem gravar nada) que o usuario logado pode decidir esta
  // solicitacao AGORA: e' um vendedor cadastrado, a solicitacao existe e
  // esta pendente, nao e' o proprio solicitante e o papel tem alcada. Mesmas
  // regras e mesmos erros HTTP de decidir() - usado pela decisao por ITEM
  // (DecisaoDescontoPedidoService), que decide itens separadamente.
  async autorizarDecisao(solicitacaoId: string, aprovadorUsuarioId: string) {
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
      throw new NotFoundException(`Solicitacao de desconto ${solicitacaoId} nao encontrada`);
    }

    const entidade = new SolicitacaoDesconto({
      id: registro.id,
      vendedorSolicitanteId: registro.vendedorSolicitanteId,
      papelExigido: registro.papelExigido,
      status: registro.status,
    });
    try {
      entidade.aprovar({ id: aprovadorVendedor.id, papel: aprovadorVendedor.papel });
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

    return { registro, aprovadorVendedor };
  }

  // Solicitacao mais recente do pedido + se o usuario logado pode decidi-la
  // agora (GET /pedidos/:id). null quando o pedido nunca precisou de
  // aprovacao de desconto.
  async obterDoPedido(
    pedidoId: string,
    usuarioId: string,
  ): Promise<SolicitacaoDescontoDoPedidoDto | null> {
    const registro = await this.prisma.solicitacaoDesconto.findFirst({
      where: { pedidoId },
      orderBy: { criadoEm: 'desc' },
      include: { aprovadorEsperado: { select: { nome: true } } },
    });
    if (!registro) return null;

    const vendedorLogado = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
      select: { id: true, papel: true },
    });
    const podeDecidir =
      vendedorLogado !== null &&
      new SolicitacaoDesconto({
        id: registro.id,
        vendedorSolicitanteId: registro.vendedorSolicitanteId,
        papelExigido: registro.papelExigido,
        status: registro.status,
      }).podeSerDecididaPor({ id: vendedorLogado.id, papel: vendedorLogado.papel });

    return {
      id: registro.id,
      status: registro.status,
      percentualSolicitado: registro.percentualSolicitado.toNumber(),
      papelExigido: registro.papelExigido,
      aprovadorEsperadoNome: registro.aprovadorEsperado?.nome ?? null,
      podeDecidir,
    };
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

      // A decisao vale pro pedido inteiro: itens refletem o resultado (a
      // tela de detalhe mostra o status de cada item).
      if (resultado.pedidoId) {
        await tx.pedidoItem.updateMany({
          where: { pedidoId: resultado.pedidoId },
          data: {
            statusAprovacao: novoStatus,
            decididoPorId: aprovadorUsuarioId,
            decididoEm: new Date(),
          },
        });
      }

      await registrarEventoNotificacao(tx, {
        tipo: 'SOLICITACAO_DESCONTO_DECIDIDA',
        referenciaId: resultado.id,
        titulo: novoStatus === 'APROVADO' ? 'Desconto aprovado' : 'Desconto rejeitado',
        corpo:
          novoStatus === 'APROVADO'
            ? `Seu pedido de ${registro.percentualSolicitado}% de desconto foi aprovado.`
            : `Seu pedido de ${registro.percentualSolicitado}% de desconto foi rejeitado.`,
        dados: {
          solicitacaoId: resultado.id,
          status: novoStatus,
          ...(resultado.pedidoId && { pedidoId: resultado.pedidoId }),
        },
      });

      return resultado;
    });

    return paraDto(atualizada);
  }
}

// Wrapper de SolicitacaoDesconto.avaliar() (dominio puro) que traduz
// DescontoExcedeAlcadaMaximaError pra UnprocessableEntityException - usado
// tanto por avaliarDesconto() (persiste) quanto simular() (pura), mesmo
// tratamento de erro nos dois.
function avaliarComTratamento(
  percentualSolicitado: number,
  papelSolicitante: PapelVendedor,
  config: ConfiguracaoDescontoDto,
): ReturnType<typeof SolicitacaoDesconto.avaliar> {
  try {
    return SolicitacaoDesconto.avaliar(percentualSolicitado, papelSolicitante, config);
  } catch (error) {
    if (error instanceof DescontoExcedeAlcadaMaximaError) {
      throw new UnprocessableEntityException(error.message);
    }
    throw error;
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
}, extras: { podeDecidir: boolean }): SolicitacaoDescontoResumoDto {
  return {
    ...paraDto(registro),
    podeDecidir: extras.podeDecidir,
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
