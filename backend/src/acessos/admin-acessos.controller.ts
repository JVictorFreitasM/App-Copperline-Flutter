import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AcessosService } from './acessos.service';
import type { ContaAcessoDto } from './acessos.service';
import { BloquearContaDto } from './dto/bloquear-conta.dto';

// Protegido por requireAuth + requireRole('admin') (ver acessos.module.ts).
@Controller('admin/acessos')
export class AdminAcessosController {
  constructor(private readonly acessos: AcessosService) {}

  @Get()
  listar(): Promise<ContaAcessoDto[]> {
    return this.acessos.listar();
  }

  @Post('contas/:id/bloquear')
  @HttpCode(204)
  async bloquear(
    @Param('id') id: string,
    @Body() dto: BloquearContaDto,
    @CurrentUser() admin: IdpUser,
  ): Promise<void> {
    await this.acessos.bloquear(id, admin.sub, dto.motivo);
  }

  @Post('contas/:id/desbloquear')
  @HttpCode(204)
  async desbloquear(@Param('id') id: string): Promise<void> {
    await this.acessos.desbloquear(id);
  }

  @Delete('sessoes/:idSessao')
  @HttpCode(204)
  async encerrarSessao(@Param('idSessao') idSessao: string): Promise<void> {
    await this.acessos.encerrarSessao(idSessao);
  }
}
