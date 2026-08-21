import { IsInt, Min } from 'class-validator';

export class AtualizarConfiguracaoSyncEstoqueDto {
  @IsInt()
  @Min(1)
  intervaloSincronizacaoMinutos!: number;
}

export interface ConfiguracaoSyncEstoqueDto {
  intervaloSincronizacaoMinutos: number;
  ultimaSincronizacaoEm: string | null;
}
