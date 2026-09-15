import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AtualizarTipoAcondicionamentoDto } from './dto/atualizar-tipo-acondicionamento.dto';
import { CriarTipoAcondicionamentoDto } from './dto/criar-tipo-acondicionamento.dto';
import type { TipoAcondicionamentoDto } from './dto/tipo-acondicionamento-response.dto';
import { TiposAcondicionamentoService } from './tipos-acondicionamento.service';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver tipos-acondicionamento.module.ts) - cadastro/edicao de catalogo,
// mesmo criterio de AdminProdutosController.
@Controller('admin/tipos-acondicionamento')
export class AdminTiposAcondicionamentoController {
  constructor(private readonly tiposAcondicionamentoService: TiposAcondicionamentoService) {}

  @Get()
  listar(): Promise<TipoAcondicionamentoDto[]> {
    return this.tiposAcondicionamentoService.listarTodos();
  }

  @Post()
  criar(@Body() dto: CriarTipoAcondicionamentoDto): Promise<TipoAcondicionamentoDto> {
    return this.tiposAcondicionamentoService.criar(dto);
  }

  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarTipoAcondicionamentoDto,
  ): Promise<TipoAcondicionamentoDto> {
    return this.tiposAcondicionamentoService.atualizar(id, dto);
  }
}
