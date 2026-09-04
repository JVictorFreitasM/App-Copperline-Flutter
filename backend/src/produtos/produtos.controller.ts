import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, StreamableFile } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PaginatedResult } from '../common/pagination';
import { FavoritosService } from '../notificacoes/favoritos.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ProdutoCalculoService } from './produto-calculo.service';
import { ProdutoManualService } from './produto-manual.service';
import type { ResultadoCalculoQuantidade } from './domain/calculo-quantidade-pedido';
import { ProdutosService } from './produtos.service';
import { ProdutosRupturaService } from './produtos-ruptura.service';
import type { ProdutoRupturaPrevistaDto } from './produtos-ruptura.service';
import type {
  ProdutoDetalheDto,
  ProdutoResumoDto,
} from './dto/produto-response.dto';
import { CalcularQuantidadeDto } from './dto/calcular-quantidade.dto';
import { ListarProdutosQueryDto } from './dto/listar-produtos-query.dto';
import { RupturaPrevistaQueryDto } from './dto/ruptura-prevista-query.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver produtos.module.ts).
@Controller('produtos')
export class ProdutosController {
  constructor(
    private readonly produtosService: ProdutosService,
    private readonly favoritosService: FavoritosService,
    private readonly usuariosService: UsuariosService,
    private readonly produtosRupturaService: ProdutosRupturaService,
    private readonly produtoCalculoService: ProdutoCalculoService,
    private readonly produtoManualService: ProdutoManualService,
  ) {}

  @Get()
  listar(
    @Query() query: ListarProdutosQueryDto,
  ): Promise<PaginatedResult<ProdutoResumoDto>> {
    return this.produtosService.listar(query);
  }

  // Rotas literais (favoritos, :id/favoritos) ANTES de `:id` de proposito -
  // NestJS resolve rotas na ordem de declaracao dentro do controller;
  // `:id` (GET) casaria com "favoritos" como valor de id se viesse antes
  // (ver OS-BACKEND-19, mesmo motivo pelo qual isso ficou aqui em vez de
  // um controller separado noutro modulo).
  @Get('favoritos')
  async listarFavoritos(@CurrentUser() idpUser: IdpUser): Promise<ProdutoResumoDto[]> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.favoritosService.listar(usuario.id);
  }

  @Post(':id/favoritos')
  @HttpCode(204)
  async favoritar(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<void> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    await this.favoritosService.favoritar(usuario.id, id);
  }

  @Delete(':id/favoritos')
  @HttpCode(204)
  async desfavoritar(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<void> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    await this.favoritosService.desfavoritar(usuario.id, id);
  }

  // Literal, ANTES de `:id` - mesmo motivo de 'favoritos' acima
  // (OS-BACKEND-20).
  @Get('ruptura-prevista')
  obterRupturaPrevista(
    @Query() query: RupturaPrevistaQueryDto,
  ): Promise<ProdutoRupturaPrevistaDto[]> {
    return this.produtosRupturaService.calcular(query.dias);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string): Promise<ProdutoDetalheDto> {
    return this.produtosService.buscarPorId(id);
  }

  // Leitura (qualquer vendedor autenticado, mesmo criterio de GET ':id'
  // acima) - a escrita (upload/edicao) fica em AdminProdutosController,
  // role admin.
  @Get(':id/imagem')
  async imagem(@Param('id') id: string): Promise<StreamableFile> {
    const { buffer, tipoMime } = await this.produtoManualService.obterImagem(id);
    return new StreamableFile(buffer, { type: tipoMime });
  }

  // OS-BACKEND-24 - chamado antes de adicionar item ao pedido (mobile e
  // web, OS-WEB-22). "/:id/calcular" e' mais especifico que "/:id" (2
  // segmentos vs 1), sem risco de colisao independente da ordem de
  // declaracao (mesmo raciocinio de "/:id/resumo" em clientes.controller.ts).
  @Post(':id/calcular')
  calcular(
    @Param('id') id: string,
    @Body() dto: CalcularQuantidadeDto,
  ): Promise<ResultadoCalculoQuantidade> {
    return this.produtoCalculoService.calcular(id, dto.metrosDesejados);
  }
}
