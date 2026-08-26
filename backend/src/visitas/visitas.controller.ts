import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { IdpUser } from '@copperline/idp-client';
import type { PaginatedResult } from '../common/pagination';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CancelarVisitaDto } from './dto/cancelar-visita.dto';
import { CheckinVisitaDto } from './dto/checkin-visita.dto';
import { CheckoutVisitaDto } from './dto/checkout-visita.dto';
import { ListarVisitasQueryDto } from './dto/listar-visitas-query.dto';
import type { VisitaDto, VisitaEquipeDto } from './dto/visita-response.dto';
import { VisitaFotoStorageService } from './visita-foto-storage.service';
import { VisitasService } from './visitas.service';

// Foto obrigatoria (criterio: "so tirando direto da camera dentro do
// app") - a restricao de "nunca upload/galeria" em si e' imposta pela UI
// do app mobile (nao ha como o backend distinguir uma foto tirada agora
// de uma escolhida da galeria so pelos bytes recebidos); o que o backend
// de fato valida e' a correspondencia EXIF de data/hora (ver
// VisitasService.validarFotoOuFalhar). Teto de tamanho so protecao contra
// abuso, nao um requisito de qualidade de imagem.
const TAMANHO_MAXIMO_FOTO_BYTES = 10 * 1024 * 1024;

// Protegido por requireAuth via MiddlewareConsumer (ver visitas.module.ts).
@Controller('visitas')
export class VisitasController {
  constructor(
    private readonly visitasService: VisitasService,
    private readonly usuariosService: UsuariosService,
    private readonly fotoStorageService: VisitaFotoStorageService,
  ) {}

  // Painel de revisao do supervisor (OS-WEB-26) - escopado por hierarquia
  // dentro de VisitasService.listarEquipe (VendedorEscopoService), nao
  // aqui. Rota GET raiz - sem colisao com os POSTs abaixo.
  @Get()
  async listarEquipe(
    @Query() query: ListarVisitasQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PaginatedResult<VisitaEquipeDto>> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.visitasService.listarEquipe(idpUser, usuario.id, query);
  }

  // Mesma foto de GET /admin/visitas/:id/foto (ApiKeyGuard, sem escopo),
  // mas por sessao e escopada por equipe - e' esta que o painel web
  // (OS-WEB-26) usa, ja que o supervisor esta logado via SSO, nao com uma
  // API key generica.
  @Get(':id/foto')
  @Header('Content-Type', 'image/jpeg')
  async obterFotoEquipe(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<StreamableFile> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const caminho = await this.visitasService.obterCaminhoFotoEquipe(idpUser, usuario.id, id);
    const buffer = await this.fotoStorageService.ler(caminho);
    return new StreamableFile(buffer);
  }

  @Post('checkin')
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: TAMANHO_MAXIMO_FOTO_BYTES } }),
  )
  async checkin(
    @Body() dto: CheckinVisitaDto,
    @UploadedFile() foto: Express.Multer.File | undefined,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VisitaDto> {
    if (!foto) {
      throw new BadRequestException('Foto da fachada é obrigatória para o check-in');
    }
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.visitasService.checkin(usuario.id, dto, foto.buffer);
  }

  @Post(':id/checkout')
  async checkout(
    @Param('id') id: string,
    @Body() dto: CheckoutVisitaDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VisitaDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.visitasService.checkout(usuario.id, id, dto);
  }

  // Vendedor errou o cliente - cancela ANTES do checkout (ver
  // VisitasService.cancelar).
  @Post(':id/cancelar')
  async cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarVisitaDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VisitaDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.visitasService.cancelar(usuario.id, id, dto.comentario);
  }
}
