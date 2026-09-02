import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { DocumentoDto } from './dto/documento-response.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { DocumentosService, TAMANHO_MAXIMO_BYTES } from './documentos.service';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver documentos.module.ts) - usuario humano logado via SSO fazendo
// upload pelo painel, nao automacao/servico (por isso requireAuth+role, e
// nao ApiKeyGuard - ver README de examples/authorization-example).
@Controller('admin/documentos')
export class AdminDocumentosController {
  constructor(
    private readonly documentosService: DocumentosService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: TAMANHO_MAXIMO_BYTES } }),
  )
  async upload(
    @Body() dto: UploadDocumentoDto,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<DocumentoDto> {
    if (!arquivo) {
      throw new BadRequestException('Arquivo é obrigatório');
    }
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.documentosService.criar(usuario.id, dto, arquivo);
  }

  // "Substituir" (critério da OS-WEB-38) não tem endpoint próprio - é
  // remover + novo upload do painel, sem versionamento.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remover(@Param('id') id: string): Promise<void> {
    return this.documentosService.remover(id);
  }
}
