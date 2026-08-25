import { Body, Controller, Param, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CheckinVisitaDto } from './dto/checkin-visita.dto';
import { CheckoutVisitaDto } from './dto/checkout-visita.dto';
import type { VisitaDto } from './dto/visita-response.dto';
import { VisitasService } from './visitas.service';

// Protegido por requireAuth via MiddlewareConsumer (ver visitas.module.ts).
@Controller('visitas')
export class VisitasController {
  constructor(
    private readonly visitasService: VisitasService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Post('checkin')
  async checkin(
    @Body() dto: CheckinVisitaDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VisitaDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.visitasService.checkin(usuario.id, dto);
  }

  @Post(':id/checkout')
  async checkout(
    @Param('id') id: string,
    @Body() dto: CheckoutVisitaDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VisitaDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.visitasService.checkout(usuario.id, id, dto);
  }
}
