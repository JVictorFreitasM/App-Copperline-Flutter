import { IsEnum, Matches } from 'class-validator';
import type { TipoPeriodicidadeMeta } from '../../../generated/prisma/client';

const REGEX_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$|^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

// GET /vendedores/:id/meta-progresso - separado de MesAnoQueryDto (usado
// por equipe/ranking, que continua so mensal, fora de escopo do pedido do
// usuario 2026-09-28) de proposito, pra nao acoplar os dois endpoints.
export class MetaProgressoQueryDto {
  @IsEnum(['MENSAL', 'SEMANAL'])
  periodicidade!: TipoPeriodicidadeMeta;

  @Matches(REGEX_PERIODO, {
    message: 'periodo deve estar no formato YYYY-MM (mensal) ou YYYY-Www (semanal)',
  })
  periodo!: string;
}
