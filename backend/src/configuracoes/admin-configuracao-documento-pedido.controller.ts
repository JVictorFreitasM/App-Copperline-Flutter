import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { ComunicadoPedidoPdfDto } from './comunicado-pedido-pdf.service';
import { ComunicadoPedidoPdfService } from './comunicado-pedido-pdf.service';
import type { DadosEmpresaPdfDto } from './dados-empresa-pdf.service';
import { DadosEmpresaPdfService } from './dados-empresa-pdf.service';
import { AtualizarComunicadoPedidoPdfDto } from './dto/atualizar-comunicado-pedido-pdf.dto';
import { AtualizarDadosEmpresaPdfDto } from './dto/atualizar-dados-empresa-pdf.dto';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver configuracoes.module.ts) - aba "Documento do Pedido" da tela de
// Configuracoes (pedido do usuario, 2026-09-28): cabecalho fixo +
// comunicado (2a pagina) do PDF de impressao do pedido (ver
// PedidoPdfService). Os dois recursos vivem no mesmo controller por serem
// sempre editados juntos na mesma aba, mas sao servicos/tabelas
// independentes.
@Controller('admin/configuracoes/documento-pedido')
export class AdminConfiguracaoDocumentoPedidoController {
  constructor(
    private readonly dadosEmpresaPdfService: DadosEmpresaPdfService,
    private readonly comunicadoPedidoPdfService: ComunicadoPedidoPdfService,
  ) {}

  @Get('empresa')
  obterDadosEmpresa(): Promise<DadosEmpresaPdfDto> {
    return this.dadosEmpresaPdfService.obter();
  }

  @Patch('empresa')
  atualizarDadosEmpresa(
    @Body() dto: AtualizarDadosEmpresaPdfDto,
  ): Promise<DadosEmpresaPdfDto> {
    return this.dadosEmpresaPdfService.atualizar(dto);
  }

  @Get('comunicado')
  obterComunicado(): Promise<ComunicadoPedidoPdfDto> {
    return this.comunicadoPedidoPdfService.obter();
  }

  @Patch('comunicado')
  atualizarComunicado(
    @Body() dto: AtualizarComunicadoPedidoPdfDto,
  ): Promise<ComunicadoPedidoPdfDto> {
    return this.comunicadoPedidoPdfService.atualizar(dto.texto);
  }
}
