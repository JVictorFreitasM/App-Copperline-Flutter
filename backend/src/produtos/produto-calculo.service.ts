import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrecoProdutoService } from '../tabelas-preco/preco-produto.service';
import {
  calcularQuantidadePedido,
  QuantidadeNaoFechaEmUnidadeError,
} from './domain/calculo-quantidade-pedido';
import type { UnidadeCalculo } from './domain/calculo-quantidade-pedido';

export interface OpcoesCalculo {
  codigoTabela?: string;
  percentualDesconto?: number;
}

// OS-novas-implementacoes.md Bloco 1 - valorFinal e' valorTotal (base) com
// percentualDesconto aplicado (igual a valorTotal quando sem desconto).
// margemLucro fica SEMPRE null por enquanto - formula pendente de
// confirmacao (ver OS-pendentes-claude-code.md), nunca inventada.
export interface ResultadoCalculoComPreco {
  quantidade: number;
  unidade: UnidadeCalculo;
  valorUnitario: number;
  valorFinal: number;
  margemLucro: number | null;
}

// Orquestra a funcao de dominio (calcularQuantidadePedido, ver
// domain/calculo-quantidade-pedido.ts) com Prisma - a funcao decide, este
// service so busca o produto e persiste erros de dominio como excecoes
// HTTP claras.
@Injectable()
export class ProdutoCalculoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly precoProdutoService: PrecoProdutoService,
  ) {}

  async calcular(
    produtoId: string,
    metrosDesejados: number,
    opcoes: OpcoesCalculo = {},
  ): Promise<ResultadoCalculoComPreco> {
    const produto = await this.prisma.produto.findUnique({
      where: { id: produtoId },
      include: { tipoAcondicionamento: true },
    });
    if (!produto) {
      throw new NotFoundException(`Produto '${produtoId}' não encontrado`);
    }

    const precoVenda = await this.resolverPrecoVenda(produto, opcoes.codigoTabela);
    if (precoVenda === null) {
      throw new UnprocessableEntityException(
        opcoes.codigoTabela
          ? `Produto '${produtoId}' sem preço cadastrado na tabela '${opcoes.codigoTabela}'`
          : `Produto '${produtoId}' sem preço de venda cadastrado - não é possível calcular o pedido`,
      );
    }

    try {
      // Produto sem tipo de acondicionamento associado (ou tipo cadastrado
      // como retalho, tamanhoPadrao null) se comporta como retalho -
      // decisao confirmada com o usuario, nao bloqueia produto ainda nao
      // classificado.
      const tamanhoPadrao = produto.tipoAcondicionamento?.tamanhoPadrao?.toNumber() ?? null;
      const resultado = calcularQuantidadePedido(tamanhoPadrao, precoVenda, metrosDesejados);

      const valorFinal = opcoes.percentualDesconto
        ? arredondarMoeda(resultado.valorTotal * (1 - opcoes.percentualDesconto / 100))
        : resultado.valorTotal;

      return {
        quantidade: resultado.quantidade,
        unidade: resultado.unidade,
        valorUnitario: precoVenda,
        valorFinal,
        // Formula de margem ainda nao confirmada com o time (varejo vs.
        // markup sobre custo) - nunca inventar um numero aqui, ver
        // OS-pendentes-claude-code.md.
        margemLucro: null,
      };
    } catch (error) {
      if (error instanceof QuantidadeNaoFechaEmUnidadeError) {
        // Valor pedido invalido pra este produto - o cliente da API pode
        // corrigir enviando outro valor (400).
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  // codigoTabela explicito (Bloco 1) NUNCA cai silenciosamente pro
  // fallback global/precoVenda cru - o usuario pediu essa tabela
  // especificamente, um preco de outra fonte seria enganoso. Sem
  // codigoTabela, comportamento original: tabela selecionada globalmente,
  // com fallback pro precoVenda cru sincronizado do Radar.
  private async resolverPrecoVenda(
    produto: { codigo: string | null; precoVenda: { toNumber(): number } | null },
    codigoTabela?: string,
  ): Promise<number | null> {
    if (codigoTabela) {
      if (!produto.codigo) return null;
      const preco = await this.precoProdutoService.obterPrecoPorCodigoDeTabela(
        codigoTabela,
        produto.codigo,
      );
      return preco ? Number(preco) : null;
    }

    const precoTabela = produto.codigo
      ? await this.precoProdutoService.obterPrecoPorCodigo(produto.codigo)
      : null;
    if (precoTabela) return Number(precoTabela);
    return produto.precoVenda?.toNumber() ?? null;
  }
}

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
