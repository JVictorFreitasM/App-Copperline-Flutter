import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraAgendamentoVisitaDto,
  type AgendamentoVisitaDto,
} from './dto/agendamento-visita-response.dto';

export interface CriarAgendamentoVisitaInput {
  clienteId: string;
  dataHoraPrevista: Date;
}

// OS-novas-implementacoes.md Bloco 5 - CRUD simples (sem regra de negocio
// alem do escopo por vendedor, ja padrao no projeto) - sem entidade de
// dominio separada.
@Injectable()
export class AgendamentosVisitaService {
  constructor(private readonly prisma: PrismaService) {}

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
