import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { Prisma } from '../../generated/prisma/client';
import { filtroPeriodo } from '../dashboard/filtro-periodo';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import {
  paraAgendamentoVisitaDto,
  paraAgendamentoVisitaEquipeDto,
  type AgendamentoVisitaDto,
  type AgendamentoVisitaEquipeDto,
} from './dto/agendamento-visita-response.dto';

export interface CriarAgendamentoVisitaInput {
  clienteId: string;
  dataHoraPrevista: Date;
}

export interface ListarAgendamentosEquipeInput {
  vendedorId?: string;
  dataInicial?: string;
  dataFinal?: string;
}

// OS-novas-implementacoes.md Bloco 5 - CRUD simples (sem regra de negocio
// alem do escopo por vendedor, ja padrao no projeto) - sem entidade de
// dominio separada.
@Injectable()
export class AgendamentosVisitaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendedorEscopoService: VendedorEscopoService,
  ) {}

  // Mesmo criterio de VisitasService.checkin(): so agenda visita pra
  // cliente que o PROPRIO vendedor atende (nao a equipe inteira, mesmo se
  // for supervisor/gerente) - agendamento e' preparacao de um evento de
  // campo individual, mesmo raciocinio de "visita e' individual" ja usado
  // la.
  async criar(
    usuarioId: string,
    input: CriarAgendamentoVisitaInput,
  ): Promise<AgendamentoVisitaDto> {
    const vendedor = await this.resolverVendedor(usuarioId);

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: input.clienteId, vendedores: { some: { vendedorId: vendedor.id } } },
      select: { id: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${input.clienteId}' não encontrado`);
    }

    const agendamento = await this.prisma.agendamentoVisita.create({
      data: {
        clienteId: input.clienteId,
        vendedorId: vendedor.id,
        dataHoraPrevista: input.dataHoraPrevista,
        criadoPorId: usuarioId,
      },
    });
    return paraAgendamentoVisitaDto(agendamento);
  }

  // "Minha agenda" - so os proprios agendamentos (mesmo escopo individual
  // da criacao acima), com filtro opcional por cliente.
  async listarPorVendedor(
    usuarioId: string,
    clienteId?: string,
  ): Promise<AgendamentoVisitaDto[]> {
    const vendedor = await this.resolverVendedor(usuarioId);
    const agendamentos = await this.prisma.agendamentoVisita.findMany({
      where: { vendedorId: vendedor.id, ...(clienteId && { clienteId }) },
      orderBy: { dataHoraPrevista: 'asc' },
    });
    return agendamentos.map(paraAgendamentoVisitaDto);
  }

  // GET /agendamentos-visita/equipe (painel do supervisor/admin) - mesmo
  // gate de papel/escopo de VisitasService.listarEquipe (que essa OS
  // originalmente nao tinha equivalente pra agendamento, so "minha
  // agenda"): SUPERVISOR/GERENTE ve a equipe recursiva, admin ve todos,
  // VENDEDOR comum ou sem Vendedor vinculado nao tem "equipe" - 403, nunca
  // lista vazia (mesmo criterio anti-confusao do resto do projeto).
  // vendedorId no filtro fora do escopo: 404 (anti-IDOR). Sem paginacao
  // (mesmo criterio de listarPorVendedor acima) - agendamento e' evento
  // futuro, volume sempre pequeno mesmo somando a equipe inteira.
  async listarEquipe(
    idpUser: IdpUser,
    usuarioId: string,
    filtro: ListarAgendamentosEquipeInput,
  ): Promise<AgendamentoVisitaEquipeDto[]> {
    const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
      idpUser,
      usuarioId,
    );

    if (escopo.tipo === 'NENHUM' || escopo.tipo === 'PROPRIO') {
      throw new ForbiddenException(
        'Usuario autenticado nao tem papel de supervisao (supervisor/gerente) - sem equipe para revisar',
      );
    }
    if (
      escopo.tipo === 'EQUIPE' &&
      filtro.vendedorId &&
      !escopo.vendedorIds.includes(filtro.vendedorId)
    ) {
      throw new NotFoundException(`Vendedor '${filtro.vendedorId}' não encontrado`);
    }

    const vendedorWhere = filtro.vendedorId
      ? { vendedorId: filtro.vendedorId }
      : escopo.tipo === 'EQUIPE'
        ? { vendedorId: { in: escopo.vendedorIds } }
        : {};

    const where: Prisma.AgendamentoVisitaWhereInput = {
      ...vendedorWhere,
      ...(filtroPeriodo(filtro.dataInicial, filtro.dataFinal) && {
        dataHoraPrevista: filtroPeriodo(filtro.dataInicial, filtro.dataFinal),
      }),
    };

    const agendamentos = await this.prisma.agendamentoVisita.findMany({
      where,
      orderBy: { dataHoraPrevista: 'asc' },
      include: {
        vendedor: { select: { id: true, nome: true } },
        cliente: { select: { id: true, razaoSocial: true } },
      },
    });

    return agendamentos.map(paraAgendamentoVisitaEquipeDto);
  }

  private async resolverVendedor(usuarioId: string) {
    const vendedor = await this.prisma.vendedor.findFirst({ where: { usuarioId } });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado - não pode agendar visita',
      );
    }
    return vendedor;
  }
}
