import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PeriodoQueryDto } from './periodo-query.dto';

export class RankingQueryDto extends PeriodoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite: number = 10;
}

export interface RankingItemDto {
  id: string;
  nome: string;
  valorTotal: string;
}

export interface RankingDashboardDto {
  periodo: { dataInicial: string | null; dataFinal: string | null };
  // Top clientes por soma de Pedido.valorTotal no periodo.
  topClientes: RankingItemDto[];
  // Top produtos por soma de PedidoItem.valorTotal no periodo (Pedido nao
  // se quebra por produto - so PedidoItem tem essa granularidade).
  topProdutos: RankingItemDto[];
  // Top vendedores por soma de Pedido.valorTotal dos clientes vinculados a
  // cada um (ClienteVendedor) - Pedido.vendedorId so existe pra pedido
  // criado localmente pelo app (ainda bloqueado, OS-BACKEND-25), entao a
  // atribuicao real hoje e' via vinculo cliente-vendedor, nao o campo
  // direto do pedido. Confirmado com o usuario: na pratica um cliente tem
  // um so vendedor (o N:N do schema e' so folga estrutural).
  topVendedores: RankingItemDto[];
}
