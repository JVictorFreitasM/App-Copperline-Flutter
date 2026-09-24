import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// Compartilhado por vendas/ranking/notas-fiscais (OS-BACKEND-17) - mesmo
// par de campos que ja se repetia em listar-pedidos-query.dto.ts sem
// abstracao; primeira vez que 3+ endpoints usam o mesmo filtro de periodo
// ao mesmo tempo, entao vale extrair (mesmo padrao de PaginationQueryDto).
export class PeriodoQueryDto {
  @IsOptional()
  @IsDateString()
  dataInicial?: string;

  @IsOptional()
  @IsDateString()
  dataFinal?: string;

  // Filtro "Equipe" do painel (Epico 1.2) - omitido mostra o escopo
  // inteiro de quem esta logado (equipe toda pra supervisor/gerente, so a
  // propria carteira pra vendedor comum); informado restringe pra UM
  // vendedor especifico, validado contra o escopo em
  // DashboardController/VendedorEscopoService.restringirEscopoPorVendedorId
  // (nunca confiar nesse valor cru vindo da query string).
  @IsOptional()
  @IsUUID()
  vendedorId?: string;
}
