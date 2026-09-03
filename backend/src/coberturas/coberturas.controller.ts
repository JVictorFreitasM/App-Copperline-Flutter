import { Controller, Get, Param } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CoberturaResumoService } from './cobertura-resumo.service';
import type { CoberturaResumoDto } from './cobertura-resumo.service';

// OS-BACKEND-48 - session auth via requireAuth (ver coberturas.module.ts).
@Controller('coberturas')
export class CoberturasController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly coberturaResumoService: CoberturaResumoService,
  ) {}

  @Get(':id/resumo')
  async obterResumo(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<CoberturaResumoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.coberturaResumoService.obterResumo(id, idpUser, usuario.id);
  }
}
