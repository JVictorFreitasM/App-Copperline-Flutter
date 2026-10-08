import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfiguracaoFuncionalidadesService } from './configuracao-funcionalidades.service';
import type { ConfiguracaoFuncionalidadesDto } from './configuracao-funcionalidades.service';
import { AtualizarConfiguracaoFuncionalidadesDto } from './dto/atualizar-configuracao-funcionalidades.dto';

// Protegido por requireAuth + requireRole('admin') (ver configuracoes.module.ts).
@Controller('admin/configuracoes/funcionalidades')
export class AdminConfiguracaoFuncionalidadesController {
  constructor(private readonly service: ConfiguracaoFuncionalidadesService) {}

  @Get()
  obter(): Promise<ConfiguracaoFuncionalidadesDto> {
    return this.service.obter();
  }

  @Patch()
  atualizar(
    @Body() dto: AtualizarConfiguracaoFuncionalidadesDto,
  ): Promise<ConfiguracaoFuncionalidadesDto> {
    return this.service.atualizar(dto);
  }
}
