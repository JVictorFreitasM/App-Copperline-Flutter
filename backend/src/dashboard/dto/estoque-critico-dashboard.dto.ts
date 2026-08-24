import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

// Sem campo de "estoque minimo" no schema (SaldoEstoque nao tem esse
// dado vindo do ERP) - limiar e' uma constante do dashboard, nao um dado
// de negocio persistido. Configuravel via query param pra nao travar o
// valor pra sempre (ver "fora de escopo" da OS: "nao hardcoded sem
// justificativa") - 10 e' um chute inicial razoavel pra um catalogo de
// autopecas/materiais eletricos (mesmo tipo de produto ja visto nos dados
// reais de saldo sincronizados), ajustavel por quem usa o dashboard sem
// precisar de deploy.
export const LIMIAR_ESTOQUE_CRITICO_PADRAO = 10;

export class EstoqueCriticoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limiar: number = LIMIAR_ESTOQUE_CRITICO_PADRAO;
}

export interface ProdutoEstoqueCriticoDto {
  produtoId: string;
  nome: string | null;
  codigo: string;
  quantidadeDisponivel: string;
  // Quantos PedidoItem distintos, de pedidos em aberto (SITUACOES_EM_ABERTO
  // - mesma constante do resumo geral), referenciam este produto.
  quantidadePedidosPendentes: number;
}

export interface EstoqueCriticoDashboardDto {
  limiar: number;
  produtos: ProdutoEstoqueCriticoDto[];
}
