import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../common/pagination';
import { UsuariosService } from '../usuarios/usuarios.service';
import { EnviarMensagemDto } from './dto/enviar-mensagem.dto';
import { SalvarGrupoMensagemDto } from './dto/salvar-grupo-mensagem.dto';
import { GruposMensagemService } from './grupos-mensagem.service';
import type { GrupoMensagemDto } from './grupos-mensagem.service';
import { MensagensNotificacaoService } from './mensagens-notificacao.service';
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
