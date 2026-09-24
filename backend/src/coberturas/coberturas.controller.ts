import { Controller, Get, Param } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CoberturaResumoService } from './cobertura-resumo.service';
import type { CoberturaResumoDto } from './cobertura-resumo.service';
import { CoberturaTemporariaService } from './cobertura-temporaria.service';
import type { CoberturaTemporariaDto } from './cobertura-temporaria.service';

// OS-BACKEND-48 - session auth via requireAuth (ver coberturas.module.ts).
@Controller('coberturas')
export class CoberturasController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly coberturaResumoService: CoberturaResumoService,
    private readonly coberturaTemporariaService: CoberturaTemporariaService,
  ) {}

  // "/minha-ativa" ANTES de "/:id/resumo" nao colide (segmentos
  // diferentes: 1 vs 2), mas literal primeiro por consistencia com o
  // padrao ja usado em outros controllers (ex: "/verificar-conflito" em
  // clientes.controller.ts). Ver comentario no service - sem isso o
  // substituto nao tinha como descobrir o id da propria cobertura ativa.
  @Get('minha-ativa')
  async obterMinhaAtiva(
    @CurrentUser() idpUser: IdpUser,
  ): Promise<CoberturaTemporariaDto | null> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.coberturaTemporariaService.obterAtivaParaSubstituto(usuario.id);
  }

  @Get(':id/resumo')
  async obterResumo(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<CoberturaResumoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.coberturaResumoService.obterResumo(id, idpUser, usuario.id);
  }
}
