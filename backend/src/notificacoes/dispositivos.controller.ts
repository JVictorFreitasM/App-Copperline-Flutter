import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DispositivosService } from './dispositivos.service';
import { RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver
// notificacoes.module.ts, mesmo padrao das demais).
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  @HttpCode(204)
  async registrar(
    @CurrentUser() idpUser: IdpUser,
    @Body() dto: RegistrarDispositivoDto,
  ): Promise<void> {
    await this.dispositivosService.registrar(idpUser, dto);
  }
}
