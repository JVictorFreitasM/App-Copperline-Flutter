import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PaginatedResult } from '../common/pagination';
import { FavoritosService } from '../notificacoes/favoritos.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ProdutosService } from './produtos.service';
import type {
  ProdutoDetalheDto,
  ProdutoResumoDto,
} from './dto/produto-response.dto';
import { ListarProdutosQueryDto } from './dto/listar-produtos-query.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver produtos.module.ts).
@Controller('produtos')
export class ProdutosController {
  constructor(
    private readonly produtosService: ProdutosService,
    private readonly favoritosService: FavoritosService,
    private readonly usuariosService: UsuariosService,
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

  @Get(':id')
  buscarPorId(@Param('id') id: string): Promise<ProdutoDetalheDto> {
    return this.produtosService.buscarPorId(id);
  }
}
