import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DispositivosService } from './dispositivos.service';
import {
  RegistrarDispositivoDto,
  RemoverDispositivoDto,
} from './dto/registrar-dispositivo.dto';

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

  // POST (e nao DELETE) de proposito: o token vai no corpo, nao na URL - nao
  // aparece em log de acesso nem e tirado por proxy que descarta corpo de
  // DELETE.
  @Post('remover')
  @HttpCode(204)
  async remover(
    @CurrentUser() idpUser: IdpUser,
    @Body() dto: RemoverDispositivoDto,
  ): Promise<void> {
    await this.dispositivosService.remover(idpUser, dto);
  }
}
