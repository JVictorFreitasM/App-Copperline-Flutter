import { Controller, Get } from '@nestjs/common';
import type { TipoAcondicionamentoDto } from './dto/tipo-acondicionamento-response.dto';
import { TiposAcondicionamentoService } from './tipos-acondicionamento.service';

// Protegido por requireAuth via MiddlewareConsumer (ver
// tipos-acondicionamento.module.ts) - leitura aberta a qualquer vendedor
// autenticado, so pra popular o seletor no front (edicao fica em
// AdminTiposAcondicionamentoController, role admin).
@Controller('tipos-acondicionamento')
export class TiposAcondicionamentoController {
  constructor(private readonly tiposAcondicionamentoService: TiposAcondicionamentoService) {}

  @Get()
  listar(): Promise<TipoAcondicionamentoDto[]> {
    return this.tiposAcondicionamentoService.listarAtivos();
  }
}
