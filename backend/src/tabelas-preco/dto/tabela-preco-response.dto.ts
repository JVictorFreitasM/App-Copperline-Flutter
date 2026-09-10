import type { ItemTabelaPreco, TabelaPreco } from '../../../generated/prisma/client';

export interface TabelaPrecoResumoDto {
  id: string;
  codigo: string;
  ativa: boolean;
  quantidadeItens: number;
  sincronizadoEm: string;
}

export interface ItemTabelaPrecoDto {
  id: string;
  codigoItem: string;
  preco: string;
  precoPromocional: string | null;
  quantidadeMinima: string;
  quantidadeMaxima: string;
  percentualDescontoMaximo: string;
  valorDescontoMaximo: string;
  dataUltimoReajuste: string | null;
  dataInicioPromocao: string | null;
  dataFimPromocao: string | null;
}

export function paraTabelaPrecoResumoDto(
  tabela: TabelaPreco & { _count: { itens: number } },
): TabelaPrecoResumoDto {
  return {
    id: tabela.id,
    codigo: tabela.codigo,
    ativa: tabela.ativa,
    quantidadeItens: tabela._count.itens,
    sincronizadoEm: tabela.sincronizadoEm.toISOString(),
  };
}

export function paraItemTabelaPrecoDto(item: ItemTabelaPreco): ItemTabelaPrecoDto {
  return {
    id: item.id,
    codigoItem: item.codigoItem,
    preco: item.preco.toString(),
    precoPromocional: item.precoPromocional?.toString() ?? null,
    quantidadeMinima: item.quantidadeMinima.toString(),
    quantidadeMaxima: item.quantidadeMaxima.toString(),
    percentualDescontoMaximo: item.percentualDescontoMaximo.toString(),
    valorDescontoMaximo: item.valorDescontoMaximo.toString(),
    dataUltimoReajuste: item.dataUltimoReajuste?.toISOString() ?? null,
    dataInicioPromocao: item.dataInicioPromocao?.toISOString() ?? null,
    dataFimPromocao: item.dataFimPromocao?.toISOString() ?? null,
  };
}
