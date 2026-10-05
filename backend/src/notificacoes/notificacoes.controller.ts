import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PaginatedResult } from '../common/pagination';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ListarNotificacoesQueryDto } from './dto/listar-notificacoes-query.dto';
import { NotificacaoUsuarioService } from './notificacao-usuario.service';
import type { NotificacaoDetalheDto, NotificacaoDto } from './notificacao-usuario.service';

// Epico 5 - protegido por requireAuth via MiddlewareConsumer (ver
// notificacoes.module.ts, mesmo padrao de DispositivosController). Sempre
// "minhas notificacoes" - sem escopo de equipe/admin (inbox e' pessoal,
// mesmo criterio de VisitasController.listarMinhas).
@Controller('notificacoes')
export class NotificacoesController {
  constructor(
    private readonly notificacaoUsuarioService: NotificacaoUsuarioService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Get()
  async listar(
    @Query() query: ListarNotificacoesQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PaginatedResult<NotificacaoDto>> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.notificacaoUsuarioService.listar(usuario.id, query);
  }

  // Consultado com frequencia (badge do sino no topbar) - endpoint proprio
  // em vez do total paginado de listar(), mais barato (so um count).
  @Get('contagem-nao-lidas')
  async contarNaoLidas(@CurrentUser() idpUser: IdpUser): Promise<{ quantidade: number }> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const quantidade = await this.notificacaoUsuarioService.contarNaoLidas(usuario.id);
    return { quantidade };
  }

  // Dois segmentos fixos ('mensagens/:id') - nao colide com ':id/lida' nem
  // com 'contagem-nao-lidas'.
  @Get('mensagens/:mensagemId')
  async obterDetalheDaMensagem(
    @Param('mensagemId') mensagemId: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<NotificacaoDetalheDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.notificacaoUsuarioService.obterDetalheDaMensagem(usuario.id, mensagemId);
  }

  @Patch(':id/lida')
  async marcarComoLida(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<NotificacaoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.notificacaoUsuarioService.marcarComoLida(usuario.id, id);
  }

  // Literal, ANTES de ':id/lida' nao colidiria de qualquer forma (segmentos
  // diferentes), mas nao ha essa rota aqui - "marcar-todas-lidas" e' o
  // unico endpoint de 1 segmento so, sem risco de ambiguidade.
  @Patch('marcar-todas-lidas')
  async marcarTodasComoLidas(
    @CurrentUser() idpUser: IdpUser,
  ): Promise<{ quantidade: number }> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.notificacaoUsuarioService.marcarTodasComoLidas(usuario.id);
  }
}
