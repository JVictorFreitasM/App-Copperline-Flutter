import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AtualizarHorarioTrabalhoDto } from './dto/atualizar-horario-trabalho.dto';
import { VendedorHorarioTrabalhoService } from './vendedor-horario-trabalho.service';
import type { HorarioTrabalhoDto } from './vendedor-horario-trabalho.service';

// Sessao/SSO normal (mesmo criterio de GET /vendedores/me) - sempre o
// PROPRIO vendedor de quem chama, sem :id nem checagem de escopo (ver
// vendedor-horario-trabalho.service.ts sobre por que este controller
// vive em ConfiguracoesModule).
@Controller('vendedores/me/horario-trabalho')
export class VendedorHorarioTrabalhoController {
  constructor(
    private readonly vendedorHorarioTrabalhoService: VendedorHorarioTrabalhoService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Get()
  async obter(@CurrentUser() idpUser: IdpUser): Promise<HorarioTrabalhoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.vendedorHorarioTrabalhoService.obter(usuario.id);
  }

  @Patch()
  async atualizar(
    @CurrentUser() idpUser: IdpUser,
    @Body() dto: AtualizarHorarioTrabalhoDto,
  ): Promise<HorarioTrabalhoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.vendedorHorarioTrabalhoService.atualizar(usuario.id, dto);
  }
}
