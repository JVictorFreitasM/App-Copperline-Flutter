import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AgendamentosVisitaService } from './agendamentos-visita.service';
import { CriarAgendamentoVisitaDto } from './dto/criar-agendamento-visita.dto';
import type {
  AgendamentoVisitaDto,
  AgendamentoVisitaEquipeDto,
} from './dto/agendamento-visita-response.dto';
import { ListarAgendamentosEquipeQueryDto } from './dto/listar-agendamentos-equipe-query.dto';
import { ListarAgendamentosVisitaQueryDto } from './dto/listar-agendamentos-visita-query.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver visitas.module.ts,
// mesmo criterio de VisitasController). OS-novas-implementacoes.md Bloco 5.
@Controller('agendamentos-visita')
export class AgendamentosVisitaController {
  constructor(
    private readonly agendamentosVisitaService: AgendamentosVisitaService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Post()
  async criar(
    @Body() dto: CriarAgendamentoVisitaDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<AgendamentoVisitaDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.agendamentosVisitaService.criar(usuario.id, {
      clienteId: dto.clienteId,
      dataHoraPrevista: new Date(dto.dataHoraPrevista),
    });
  }

  @Get()
  async listar(
    @Query() query: ListarAgendamentosVisitaQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<AgendamentoVisitaDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.agendamentosVisitaService.listarPorVendedor(usuario.id, query.clienteId);
  }

  // "equipe" ANTES de nenhum ':id' existir neste controller - sem risco de
  // colisao (nao ha rota parametrizada aqui), mas literal primeiro por
  // consistencia com o padrao do resto do projeto. Gap identificado em
  // OS-pendentes-claude-code.md: so existia "minha agenda" (GET raiz
  // acima), supervisor/admin nao tinha onde ver agendamento da equipe.
  @Get('equipe')
  async listarEquipe(
    @Query() query: ListarAgendamentosEquipeQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<AgendamentoVisitaEquipeDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.agendamentosVisitaService.listarEquipe(idpUser, usuario.id, query);
  }
}
