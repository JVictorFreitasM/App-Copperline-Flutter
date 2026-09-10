import { Injectable, NotFoundException } from '@nestjs/common';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { ListarTabelasPrecoQueryDto } from './dto/listar-tabelas-preco-query.dto';
import {
  paraItemTabelaPrecoDto,
  paraTabelaPrecoResumoDto,
  type ItemTabelaPrecoDto,
  type TabelaPrecoResumoDto,
} from './dto/tabela-preco-response.dto';
import type { PaginationQueryDto } from '../common/dto/pagination-query.dto';

// Sem regra de negocio (leitura de dado ja sincronizado) - sem entidade de
// dominio separada, mesmo criterio de NotasFiscaisService (ver skill
// nest-endpoint). Selecionar qual codigo sincronizar fica em
// ConfiguracaoTabelaPrecoService (config, nao leitura de catalogo).
@Injectable()
export class TabelasPrecoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarTabelasPrecoQueryDto): Promise<TabelaPrecoResumoDto[]> {
    const tabelas = await this.prisma.tabelaPreco.findMany({
      where: { ...(query.ativa !== undefined && { ativa: query.ativa }) },
      include: { _count: { select: { itens: true } } },
      orderBy: { codigo: 'asc' },
    });
    return tabelas.map(paraTabelaPrecoResumoDto);
  }

  async buscarPorId(id: string): Promise<TabelaPrecoResumoDto> {
    const tabela = await this.prisma.tabelaPreco.findUnique({
      where: { id },
      include: { _count: { select: { itens: true } } },
    });
    if (!tabela) {
      throw new NotFoundException(`Tabela de preço '${id}' não encontrada`);
    }
    return paraTabelaPrecoResumoDto(tabela);
  }

  async listarItens(
    tabelaId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ItemTabelaPrecoDto>> {
    const tabela = await this.prisma.tabelaPreco.findUnique({ where: { id: tabelaId } });
    if (!tabela) {
      throw new NotFoundException(`Tabela de preço '${tabelaId}' não encontrada`);
    }

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.itemTabelaPreco.findMany({
        where: { tabelaPrecoId: tabelaId },
        orderBy: { codigoItem: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.itemTabelaPreco.count({ where: { tabelaPrecoId: tabelaId } }),
    ]);

    return paginar(itens.map(paraItemTabelaPrecoDto), total, query.page, query.limit);
  }
}
