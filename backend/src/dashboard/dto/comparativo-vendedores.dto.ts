import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';
import { PeriodoQueryDto } from './periodo-query.dto';

// OS-WEB-40 - radar de 2 a 4 vendedores (criterio de aceite da OS).
// `?vendedorIds=v1,v2,v3` (string unica separada por virgula, transformada
// em array aqui) - primeiro filtro multi-valor deste projeto, escolhido por
// ser mais simples de montar na URL do que `vendedorIds[]=v1&vendedorIds[]=v2`.
export class ComparativoVendedoresQueryDto extends PeriodoQueryDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  vendedorIds!: string[];
}

export interface ComparativoVendedorDto {
  vendedorId: string;
  nome: string | null;
  valorVendido: number;
  ticketMedio: number;
  // null = sem solicitacao de desconto DECIDIDA no periodo (nao "0% de
  // aprovacao") - so conta APROVADA/REJEITADA, PENDENTE nao entra na conta
  // por ainda nao ter resultado.
  taxaAprovacaoDesconto: number | null;
  quantidadeVisitas: number;
}
