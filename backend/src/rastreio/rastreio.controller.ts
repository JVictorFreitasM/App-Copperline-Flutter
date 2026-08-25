import { Body, Controller, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { EnviarLoteRastreioDto } from './dto/enviar-lote-rastreio.dto';
import { RastreioService } from './rastreio.service';
import type { RegistrarLoteResultadoDto } from './rastreio.service';

// Protegido por requireAuth via MiddlewareConsumer (ver rastreio.module.ts).
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
}
