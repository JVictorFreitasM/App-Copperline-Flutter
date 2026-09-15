import type { TipoAcondicionamento } from '../../../generated/prisma/client';

export interface TipoAcondicionamentoDto {
  id: string;
  nome: string;
  ativo: boolean;
  // null = retalho (corte fracionario livre); preenchido = tamanho fixo,
  // pedido tem que ser multiplo exato (ver domain/calculo-quantidade-pedido.ts).
  tamanhoPadrao: string | null;
}

export function paraTipoAcondicionamentoDto(
  tipo: TipoAcondicionamento,
): TipoAcondicionamentoDto {
  return {
    id: tipo.id,
    nome: tipo.nome,
    ativo: tipo.ativo,
    tamanhoPadrao: tipo.tamanhoPadrao?.toString() ?? null,
  };
}
