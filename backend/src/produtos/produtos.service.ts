import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { PrecoProdutoService } from '../tabelas-preco/preco-produto.service';
import {
  paraProdutoDetalheDto,
  paraProdutoResumoDto,
  type ProdutoDetalheDto,
  type ProdutoResumoDto,
} from './dto/produto-response.dto';
import type { ListarProdutosQueryDto } from './dto/listar-produtos-query.dto';

// So leitura sobre dado ja sincronizado do WK Radar (OS 06) - sem regra de
// negocio, entao sem entidade de dominio separada (ver skill nest-endpoint,
// criterio de DDD).
@Injectable()
export class ProdutosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly precoProdutoService: PrecoProdutoService,
  ) {}

  async listar(
    query: ListarProdutosQueryDto,
  ): Promise<PaginatedResult<ProdutoResumoDto>> {
    const where: Prisma.ProdutoWhereInput = {
      ...(query.nome && {
        nome: { contains: query.nome, mode: 'insensitive' },
      }),
      ...(query.codigo && {
        codigo: { contains: query.codigo, mode: 'insensitive' },
      }),
      ...(query.gtin && {
        gtin: { contains: query.gtin, mode: 'insensitive' },
      }),
    };

    const [[produtos, total], precosTabela] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.produto.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { nome: 'asc' },
        }),
        this.prisma.produto.count({ where }),
      ]),
      this.precoProdutoService.obterPrecosDaTabelaPadrao(),
    ]);

    return paginar(
      produtos.map((produto) =>
        paraProdutoResumoDto(produto, produto.codigo ? precosTabela.get(produto.codigo) : undefined),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async buscarPorId(id: string): Promise<ProdutoDetalheDto> {
    const produto = await this.prisma.produto.findUnique({ where: { id } });

    if (!produto) {
      throw new NotFoundException(`Produto '${id}' não encontrado`);
    }

    const precoTabela = produto.codigo
      ? await this.precoProdutoService.obterPrecoPorCodigo(produto.codigo)
      : null;

    return paraProdutoDetalheDto(produto, precoTabela ?? undefined);
  }
}
