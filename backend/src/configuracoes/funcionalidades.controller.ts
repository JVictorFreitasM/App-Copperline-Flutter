import { Controller, Get } from '@nestjs/common';
import { ConfiguracaoFuncionalidadesService } from './configuracao-funcionalidades.service';
import type { ConfiguracaoFuncionalidadesDto } from './configuracao-funcionalidades.service';

// Leitura para QUALQUER usuario logado (web e app escondem/desabilitam botoes
// conforme o estado). So leitura - a edicao e' admin-only e a regra e' aplicada
// no backend de cada funcionalidade.
@Controller('configuracoes/funcionalidades')
export class FuncionalidadesController {
  constructor(private readonly service: ConfiguracaoFuncionalidadesService) {}

  @Get()
  obter(): Promise<ConfiguracaoFuncionalidadesDto> {
    return this.service.obter();
  }
}
