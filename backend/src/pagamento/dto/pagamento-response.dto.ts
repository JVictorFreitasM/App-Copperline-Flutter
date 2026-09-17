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

// Listagem admin (GET /admin/formas-pagamento, painel de ativar/
// desativar) - traz TODAS (inclusive inativas no Radar), com os dois
// sinais de estado separados: `inativaNoErp` (vem do Radar, admin nao
// controla) e `desativadaManualmente` (o que o toggle no painel liga/
// desliga). `ativo` e' o efetivo (usado em POST /pedidos) - so pra exibir
// no painel, o toggle em si escreve/le `desativadaManualmente`.
export interface AdminFormaPagamentoDto {
  id: string;
  codigo: string | null;
  descricao: string | null;
  inativaNoErp: boolean;
  desativadaManualmente: boolean;
  ativo: boolean;
}

export interface AdminCondicaoPagamentoDto {
  id: string;
  codigo: string | null;
  nome: string | null;
  validade: string | null;
  expirada: boolean;
  desativadaManualmente: boolean;
  ativo: boolean;
}

export function paraAdminFormaPagamentoDto(
  forma: FormaPagamento,
): AdminFormaPagamentoDto {
  return {
    id: forma.id,
    codigo: forma.codigo,
    descricao: forma.descricao,
    inativaNoErp: forma.inativa,
    desativadaManualmente: forma.desativadaManualmente,
    ativo: !forma.inativa && !forma.desativadaManualmente,
  };
}

export function paraAdminCondicaoPagamentoDto(
  condicao: CondicaoPagamento,
): AdminCondicaoPagamentoDto {
  const expirada = condicao.validade != null && condicao.validade < new Date();
  return {
    id: condicao.id,
    codigo: condicao.codigo,
    nome: condicao.nome,
    validade: condicao.validade?.toISOString() ?? null,
    expirada,
    desativadaManualmente: condicao.desativadaManualmente,
    ativo: !expirada && !condicao.desativadaManualmente,
  };
}
