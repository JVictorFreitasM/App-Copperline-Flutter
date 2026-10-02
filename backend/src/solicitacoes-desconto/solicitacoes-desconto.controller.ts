import { Controller, Get, Param } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { ContextoAprovacaoDescontoDto } from './contexto-aprovacao-desconto.service';
import { ContextoAprovacaoDescontoService } from './contexto-aprovacao-desconto.service';
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
    private readonly contextoAprovacaoDescontoService: ContextoAprovacaoDescontoService,
  ) {}

  @Get()
  async listarPendentes(
    @CurrentUser() idpUser: IdpUser,
  ): Promise<SolicitacaoDescontoResumoDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.solicitacoesDescontoService.listarPendentes(idpUser, usuario.id);
  }

  // OS-BACKEND-50 - card informativo na tela de aprovacao, nunca decisao
  // automatica (ver ContextoAprovacaoDescontoService) - "/:id/contexto" e'
  // mais especifico que qualquer outra rota deste controller, sem risco
  // de colisao com "/:id/aprovar"/"/:id/rejeitar" (segmentos literais
  // distintos).
  @Get(':id/contexto')
  async obterContexto(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ContextoAprovacaoDescontoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.contextoAprovacaoDescontoService.obterContexto(id, idpUser, usuario.id);
  }

  // POST :id/aprovar e :id/rejeitar vivem em
  // pedidos/decisao-solicitacao-desconto.controller.ts (mesmo prefixo) -
  // decidir agora decide os ITENS do pedido e, ao fechar, envia ao Radar, o
  // que depende do modulo de pedidos (que ja importa este).
}
