import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { SolicitacoesDescontoService } from './solicitacoes-desconto.service';
import type {
  SolicitacaoDescontoDto,
  SolicitacaoDescontoResumoDto,
} from './solicitacoes-desconto.service';

// Protegido por requireAuth via MiddlewareConsumer (ver
// solicitacoes-desconto.module.ts) - decisao de quem PODE decidir (ou
// LISTAR, ver GET abaixo, OS-WEB-21) cada solicitacao (nivel de
// hierarquia, autoaprovacao, escopo de equipe) fica inteira dentro de
// SolicitacoesDescontoService/SolicitacaoDesconto (entidade de dominio),
// nao aqui.
@Controller('solicitacoes-desconto')
export class SolicitacoesDescontoController {
  constructor(
    private readonly solicitacoesDescontoService: SolicitacoesDescontoService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Get()
  async listarPendentes(
    @CurrentUser() idpUser: IdpUser,
  ): Promise<SolicitacaoDescontoResumoDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.solicitacoesDescontoService.listarPendentes(idpUser, usuario.id);
  }

  @Post(':id/aprovar')
  @HttpCode(200)
  async aprovar(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<SolicitacaoDescontoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.solicitacoesDescontoService.aprovar(id, usuario.id);
  }

  @Post(':id/rejeitar')
  @HttpCode(200)
  async rejeitar(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<SolicitacaoDescontoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.solicitacoesDescontoService.rejeitar(id, usuario.id);
  }
}
