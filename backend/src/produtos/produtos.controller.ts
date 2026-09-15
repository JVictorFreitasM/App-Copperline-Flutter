import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, StreamableFile } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PaginatedResult } from '../common/pagination';
import { FavoritosService } from '../notificacoes/favoritos.service';
import { ClienteTabelaPrecoService } from '../tabelas-preco/cliente-tabela-preco.service';
import { PrecoProdutoService } from '../tabelas-preco/preco-produto.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { ProdutoCalculoService } from './produto-calculo.service';
import { ProdutoManualService } from './produto-manual.service';
import type { ResultadoCalculoComPreco } from './produto-calculo.service';
import { ProdutosService } from './produtos.service';
import { ProdutosRupturaService } from './produtos-ruptura.service';
import type { ProdutoRupturaPrevistaDto } from './produtos-ruptura.service';
import type {
  ProdutoDetalheDto,
  ProdutoResumoDto,
} from './dto/produto-response.dto';
import { CalcularQuantidadeDto } from './dto/calcular-quantidade.dto';
import { ListarProdutosQueryDto } from './dto/listar-produtos-query.dto';
import { ProdutoPrecosQueryDto } from './dto/produto-precos-query.dto';
import { RupturaPrevistaQueryDto } from './dto/ruptura-prevista-query.dto';

export interface ProdutoPrecoPorTabelaDto {
  codigo: string;
  preco: string | null;
}

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
    private readonly precoProdutoService: PrecoProdutoService,
    private readonly clienteTabelaPrecoService: ClienteTabelaPrecoService,
    private readonly vendedorEscopoService: VendedorEscopoService,
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
  ): Promise<ResultadoCalculoComPreco> {
    return this.produtoCalculoService.calcular(id, dto.metrosDesejados, {
      codigoTabela: dto.codigoTabela,
      percentualDesconto: dto.percentualDesconto,
    });
  }

  // OS-novas-implementacoes.md Bloco 1 - comparativo de preco por tabela.
  // "/:id/precos" mais especifico que "/:id" (2 segmentos vs 1), mesmo
  // raciocinio de "/:id/calcular" acima. Sem clienteId: compara contra
  // toda tabela ativa. Com clienteId: restringe as tabelas associadas
  // aquele cliente (Bloco 1), escopado - vendedor so consulta cliente que
  // atende (mesmo criterio anti-IDOR de ClienteTabelaPrecoService).
  @Get(':id/precos')
  async obterPrecosPorTabela(
    @Param('id') id: string,
    @Query() query: ProdutoPrecosQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<{ tabelas: ProdutoPrecoPorTabelaDto[] }> {
    const produto = await this.produtosService.buscarPorId(id);

    let codigosRestricao: string[] | undefined;
    if (query.clienteId) {
      const escopo = await this.resolverEscopo(idpUser);
      // listarPorCliente ja lanca 404 se o cliente nao existir ou estiver
      // fora do escopo de quem esta autenticado - nao duplicado aqui.
      const codigosDoCliente = await this.clienteTabelaPrecoService.listarPorCliente(
        query.clienteId,
        escopo,
      );
      // Cliente sem NENHUMA tabela associada (fallback do Bloco 1) - sem
      // lista pra restringir, mostra o comparativo contra todas as
      // ativas, mesmo comportamento de nao informar clienteId.
      codigosRestricao = codigosDoCliente.length > 0 ? codigosDoCliente : undefined;
    }

    const tabelas = produto.codigo
      ? await this.precoProdutoService.obterPrecosPorTabela(produto.codigo, codigosRestricao)
      : [];
    return { tabelas };
  }

  private async resolverEscopo(idpUser: IdpUser): Promise<EscopoClientes> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.vendedorEscopoService.resolverEscopoClientes(idpUser, usuario.id);
  }
}
