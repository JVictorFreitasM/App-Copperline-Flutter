import { IsOptional, IsString } from 'class-validator';

export class ProdutoPrecosQueryDto {
  // Quando informado, restringe o comparativo as tabelas associadas a
  // esse cliente (ClienteTabelaPreco) - escopado (vendedor so consulta
  // cliente que atende, mesmo criterio anti-IDOR de sempre).
  @IsOptional()
  @IsString()
  clienteId?: string;
}
