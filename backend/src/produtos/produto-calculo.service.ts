import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularQuantidadePedido,
  ComprimentoNaoConfiguradoError,
  QuantidadeNaoFechaEmUnidadeError,
  TipoVendaNaoConfiguradoError,
} from './domain/calculo-quantidade-pedido';
import type { ResultadoCalculoQuantidade } from './domain/calculo-quantidade-pedido';

// Orquestra a funcao de dominio (calcularQuantidadePedido, ver
// domain/calculo-quantidade-pedido.ts) com Prisma - a funcao decide, este
// service so busca o produto e persiste erros de dominio como excecoes
// HTTP claras.
@Injectable()
export class ProdutoCalculoService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular(
    produtoId: string,
    metrosDesejados: number,
  ): Promise<ResultadoCalculoQuantidade> {
    const produto = await this.prisma.produto.findUnique({
      where: { id: produtoId },
    });
    if (!produto) {
      throw new NotFoundException(`Produto '${produtoId}' não encontrado`);
    }

    if (produto.precoVenda === null) {
      throw new UnprocessableEntityException(
        `Produto '${produtoId}' sem preço de venda cadastrado - não é possível calcular o pedido`,
      );
    }

    try {
      return calcularQuantidadePedido(
        produto.tipoVenda,
        produto.comprimentoMetros?.toNumber() ?? null,
        produto.precoVenda.toNumber(),
        metrosDesejados,
      );
    } catch (error) {
      if (
        error instanceof TipoVendaNaoConfiguradoError ||
        error instanceof ComprimentoNaoConfiguradoError
      ) {
        // Faltando configuracao no cadastro do produto - o cliente da API
        // nao tem como corrigir isso sozinho (422, nao 400).
        throw new UnprocessableEntityException(error.message);
      }
      if (error instanceof QuantidadeNaoFechaEmUnidadeError) {
        // Valor pedido invalido pra este produto - o cliente da API pode
        // corrigir enviando outro valor (400).
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
