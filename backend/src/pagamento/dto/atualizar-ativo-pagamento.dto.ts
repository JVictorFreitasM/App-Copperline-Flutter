import { IsBoolean } from 'class-validator';

// Mesmo criterio de AtualizarTipoAcondicionamentoDto.ativo - toggle simples
// (sem regra de negocio), escreve em `desativadaManualmente` (invertido).
export class AtualizarAtivoPagamentoDto {
  @IsBoolean()
  ativo!: boolean;
}
