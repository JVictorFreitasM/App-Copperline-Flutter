import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AtualizarProdutoManualDto } from './dto/atualizar-produto-manual.dto';
import type { ProdutoDetalheDto } from './dto/produto-response.dto';
import { ProdutoManualService, TAMANHO_MAXIMO_IMAGEM_BYTES } from './produto-manual.service';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver produtos.module.ts) - edicao de dado de catalogo (nao especifico de
// vendedor), mesmo criterio de AdminDocumentosController. "Apenas web"
// (pedido do usuario) e' so' ausencia de UI no app mobile - o endpoint em
// si nao tem trava tecnica que impeca uso futuro do mobile.
@Controller('admin/produtos')
export class AdminProdutosController {
  constructor(private readonly produtoManualService: ProdutoManualService) {}

  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarProdutoManualDto,
  ): Promise<ProdutoDetalheDto> {
    return this.produtoManualService.atualizar(id, dto);
  }

  @Post(':id/imagem')
  @UseInterceptors(
    FileInterceptor('imagem', { limits: { fileSize: TAMANHO_MAXIMO_IMAGEM_BYTES } }),
  )
  async enviarImagem(
    @Param('id') id: string,
    @UploadedFile() imagem: Express.Multer.File | undefined,
  ): Promise<ProdutoDetalheDto> {
    if (!imagem) {
      throw new BadRequestException('Imagem é obrigatória');
    }
    return this.produtoManualService.salvarImagem(id, imagem);
  }
}
