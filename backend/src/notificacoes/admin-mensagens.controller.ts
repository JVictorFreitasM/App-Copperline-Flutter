import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../common/pagination';
import { UsuariosService } from '../usuarios/usuarios.service';
import { EnviarMensagemDto } from './dto/enviar-mensagem.dto';
import { SalvarGrupoMensagemDto } from './dto/salvar-grupo-mensagem.dto';
import {
  AlternarMensagemPeriodicaDto,
  SalvarMensagemPeriodicaDto,
} from './dto/salvar-mensagem-periodica.dto';
import { GruposMensagemService } from './grupos-mensagem.service';
import type { GrupoMensagemDto } from './grupos-mensagem.service';
import { MensagensNotificacaoService } from './mensagens-notificacao.service';
import { MensagensPeriodicasService } from './mensagens-periodicas.service';
import type { MensagemPeriodicaDto } from './mensagens-periodicas.service';
import type {
  DestinatarioMensagemDto,
  MensagemEnviadaDto,
  ResultadoEnvioMensagemDto,
} from './mensagens-notificacao.service';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver notificacoes.module.ts) - enviar mensagem pro app do vendedor e
// manter os grupos de destinatarios e' so' do admin.
@Controller('admin/mensagens')
export class AdminMensagensController {
  constructor(
    private readonly mensagensService: MensagensNotificacaoService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Post()
  async enviar(
    @Body() dto: EnviarMensagemDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ResultadoEnvioMensagemDto> {
    const autor = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.mensagensService.enviar(autor.id, dto);
  }

  // Reenvio manual de uma mensagem ja enviada: mesmo conteudo e destino,
  // destinatarios resolvidos de novo agora. Mensagem nova no historico.
  @Post(':id/reenviar')
  async reenviar(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ResultadoEnvioMensagemDto> {
    const autor = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.mensagensService.reenviar(autor.id, id);
  }

  @Get()
  listarEnviadas(@Query() query: PaginationQueryDto): Promise<PaginatedResult<MensagemEnviadaDto>> {
    return this.mensagensService.listarEnviadas(query.page, query.limit);
  }

  @Get('destinatarios')
  listarDestinatarios(): Promise<DestinatarioMensagemDto[]> {
    return this.mensagensService.listarDestinatarios();
  }
}

@Controller('admin/grupos-mensagem')
export class AdminGruposMensagemController {
  constructor(private readonly gruposService: GruposMensagemService) {}

  @Get()
  listar(): Promise<GrupoMensagemDto[]> {
    return this.gruposService.listar();
  }

  @Post()
  criar(@Body() dto: SalvarGrupoMensagemDto): Promise<GrupoMensagemDto> {
    return this.gruposService.criar(dto);
  }

  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: SalvarGrupoMensagemDto,
  ): Promise<GrupoMensagemDto> {
    return this.gruposService.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remover(@Param('id') id: string): Promise<void> {
    return this.gruposService.remover(id);
  }
}

@Controller('admin/mensagens-periodicas')
export class AdminMensagensPeriodicasController {
  constructor(
    private readonly periodicasService: MensagensPeriodicasService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Get()
  listar(): Promise<MensagemPeriodicaDto[]> {
    return this.periodicasService.listar();
  }

  @Post()
  async criar(
    @Body() dto: SalvarMensagemPeriodicaDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<MensagemPeriodicaDto> {
    const autor = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.periodicasService.criar(autor.id, dto);
  }

  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: SalvarMensagemPeriodicaDto,
  ): Promise<MensagemPeriodicaDto> {
    return this.periodicasService.atualizar(id, dto);
  }

  @Patch(':id/ativa')
  alternar(
    @Param('id') id: string,
    @Body() dto: AlternarMensagemPeriodicaDto,
  ): Promise<MensagemPeriodicaDto> {
    return this.periodicasService.alternar(id, dto.ativa);
  }

  @Delete(':id')
  @HttpCode(204)
  remover(@Param('id') id: string): Promise<void> {
    return this.periodicasService.remover(id);
  }
}
