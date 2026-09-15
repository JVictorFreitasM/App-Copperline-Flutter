import { IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class CalcularQuantidadeDto {
  @IsNumber()
  @IsPositive()
  metrosDesejados!: number;

  // Tabela EXPLICITA a usar no calculo (OS-novas-implementacoes.md Bloco
  // 1) - ausente cai no fallback de sempre (tabela selecionada
  // globalmente, ConfiguracaoTabelaPreco -> Produto.precoVenda cru).
  @IsOptional()
  @IsString()
  codigoTabela?: string;

  // Desconto LIVRE nesta simulacao (decisao confirmada com o usuario -
  // NAO respeita percentualDescontoMaximo/valorDescontoMaximo cadastrados
  // no item da tabela, e' so' uma calculadora, sem vinculo com a regra de
  // aprovacao real de POST /pedidos).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualDesconto?: number;
}
