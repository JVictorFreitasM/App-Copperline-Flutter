import { Body, Controller, Get, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { EnviarFilaPendenteDto } from './dto/fila-pendente.dto';
import type { ResultadoAcaoFilaDto } from './dto/fila-pendente.dto';
import { FilaPendenteService } from './fila-pendente.service';
import { MobileDadosComerciaisService } from './mobile-dados-comerciais.service';
import type { DadosComerciaisMobileDto } from './mobile-dados-comerciais.service';
import { MobileSnapshotService } from './mobile-snapshot.service';
import type { MobileSnapshotDto } from './mobile-snapshot.service';

// Protegido por requireAuth via MiddlewareConsumer (ver mobile.module.ts).
@Controller('mobile')
export class MobileController {
  constructor(
    private readonly mobileSnapshotService: MobileSnapshotService,
    private readonly mobileDadosComerciaisService: MobileDadosComerciaisService,
    private readonly filaPendenteService: FilaPendenteService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Get('snapshot')
  async snapshot(@CurrentUser() idpUser: IdpUser): Promise<MobileSnapshotDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.mobileSnapshotService.obter(idpUser, usuario.id);
  }

  // Complemento do snapshot: carteira com detalhe + tabelas de preco por
  // cliente (uso offline no app).
  @Get('dados-comerciais')
  async dadosComerciais(@CurrentUser() idpUser: IdpUser): Promise<DadosComerciaisMobileDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.mobileDadosComerciaisService.obter(idpUser, usuario.id);
  }

  @Post('fila-pendente')
  async filaPendente(
    @Body() dto: EnviarFilaPendenteDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ResultadoAcaoFilaDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.filaPendenteService.processar(usuario.id, idpUser, dto.acoes);
  }
}
