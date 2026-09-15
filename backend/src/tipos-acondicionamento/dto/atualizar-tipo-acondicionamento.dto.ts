import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class AtualizarTipoAcondicionamentoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome?: string;

  // Desativar em vez de apagar (produto ja associado nao fica orfao) -
  // mesmo criterio de TabelaPreco.ativa.
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  // null explicito limpa (volta a ser retalho) - mesmo criterio de
  // AtualizarProdutoManualDto.tipoAcondicionamentoId (ValidateIf pra
  // deixar o null passar pelo class-validator sem cair na regra de
  // numero positivo).
  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsNumber()
  @IsPositive()
  tamanhoPadrao?: number | null;
}
