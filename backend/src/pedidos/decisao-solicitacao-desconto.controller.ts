import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { SolicitacaoDescontoDto } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { DecisaoDescontoPedidoService } from './decisao-desconto-pedido.service';

// Mesmo prefixo de SolicitacoesDescontoController (listar/contexto) - estas
// duas rotas ficam aqui porque decidir a solicitacao agora decide os itens do
// pedido e fecha o pedido (envio ao Radar), logica que vive neste modulo.
// Protegido por requireAuth via MiddlewareConsumer (ver pedidos.module.ts).
@Controller('solicitacoes-desconto')
export class DecisaoSolicitacaoDescontoController {
  constructor(
    private readonly decisaoDescontoPedidoService: DecisaoDescontoPedidoService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Post(':id/aprovar')
  @HttpCode(200)
  async aprovar(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<SolicitacaoDescontoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.decisaoDescontoPedidoService.decidirSolicitacao(id, usuario.id, 'aprovar');
  }

  @Post(':id/rejeitar')
  @HttpCode(200)
  async rejeitar(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<SolicitacaoDescontoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.decisaoDescontoPedidoService.decidirSolicitacao(id, usuario.id, 'rejeitar');
  }
}
