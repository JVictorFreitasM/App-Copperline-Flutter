import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ConsultarTrajetoDataQueryDto } from './dto/consultar-trajeto-data-query.dto';
import { EnviarLoteRastreioDto } from './dto/enviar-lote-rastreio.dto';
import { RastreioService } from './rastreio.service';
import type {
  PosicaoAtualVendedorDto,
  RegistrarLoteResultadoDto,
  TrajetoVendedorDto,
} from './rastreio.service';

// Protegido por requireAuth via MiddlewareConsumer (ver rastreio.module.ts)
// - sessao/SSO normal, diferente de AdminRastreioController (ApiKeyGuard).
// 'equipe'/'equipe/:vendedorId' (OS-WEB-24) precisam ser sessao porque quem
// chama e' um supervisor/gerente logado no navegador, nao uma automacao com
// API key - a decisao de QUEM pode ver o que fica inteira dentro de
// RastreioService (via VendedorEscopoService), nao aqui.
@Controller('rastreio')
export class RastreioController {
  constructor(
    private readonly rastreioService: RastreioService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Post('lote')
  async enviarLote(
    @Body() dto: EnviarLoteRastreioDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<RegistrarLoteResultadoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.rastreioService.registrarLote(usuario.id, dto.pontos);
  }

  // 'equipe' ANTES de qualquer rota com :vendedorId no mesmo nivel - aqui
  // nao ha colisao (esta e' a raiz 'equipe', a outra e' 'equipe/:id/...'),
  // mas mantido primeiro por clareza de leitura (mesma convencao de
  // produtos.controller.ts/'favoritos').
  @Get('equipe')
  async ultimasPosicoesEquipe(
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PosicaoAtualVendedorDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.rastreioService.obterUltimasPosicoesEquipe(idpUser, usuario.id);
  }

  @Get('equipe/:vendedorId/trajeto')
  async trajetoEquipe(
    @Param('vendedorId') vendedorId: string,
    @Query() query: ConsultarTrajetoDataQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<TrajetoVendedorDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.rastreioService.obterTrajetoEquipe(
      idpUser,
      usuario.id,
      vendedorId,
      query.data,
    );
  }
}
