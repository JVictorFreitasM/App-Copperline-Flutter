import type { CondicaoPagamento, FormaPagamento } from '../../../generated/prisma/client';

export interface FormaPagamentoDto {
  id: string;
  codigo: string | null;
  descricao: string | null;
}

export interface ParcelaCondicaoPagamentoDto {
  percentual: number;
  prazo: number;
}

export interface CondicaoPagamentoDto {
  id: string;
  codigo: string | null;
  nome: string | null;
  aVista: boolean;
  comEntrada: boolean;
  antecipada: boolean;
  parcelas: ParcelaCondicaoPagamentoDto[];
}

export function paraFormaPagamentoDto(forma: FormaPagamento): FormaPagamentoDto {
  return {
    id: forma.id,
    codigo: forma.codigo,
    descricao: forma.descricao,
  };
}

export function paraCondicaoPagamentoDto(
  condicao: CondicaoPagamento,
): CondicaoPagamentoDto {
  return {
    id: condicao.id,
    codigo: condicao.codigo,
    nome: condicao.nome,
    aVista: condicao.aVista,
    comEntrada: condicao.comEntrada,
    antecipada: condicao.antecipada,
    parcelas: condicao.parcelas as unknown as ParcelaCondicaoPagamentoDto[],
  };
}
