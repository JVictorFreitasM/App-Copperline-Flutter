import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

// Espelha o pipeline de aprovacao (SolicitacaoDesconto.status), nao o
// TipoSituacaoPedido do ERP (8 valores, maioria irrelevante pro
// "gargalo de aprovacao" que esta OS quer identificar) - PENDENTE aqui e'
// "aguardando decisao de um supervisor/gerente" (ver
// relatorio-pedidos.service.ts), nao "aguardando o ERP processar".
const STATUS_APROVACAO_VALIDOS = ['PENDENTE', 'APROVADO', 'REJEITADO', 'ENVIADO'] as const;

export class RelatorioPedidosQueryDto {
  // Vendedor especifico dentro da equipe do chamador - opcional, quando
  // omitido lista a equipe inteira (ver escopo em
  // RelatorioPedidosService.obter).
  @IsOptional()
  @IsUUID()
  vendedorId?: string;

  @IsOptional()
  @IsIn(STATUS_APROVACAO_VALIDOS)
  status?: (typeof STATUS_APROVACAO_VALIDOS)[number];

  // Sem os dois, o service usa "hoje" como padrao (criterio: "pedidos do
  // dia (ou periodo selecionado)").
  @IsOptional()
  @IsDateString()
  dataInicial?: string;

  @IsOptional()
  @IsDateString()
  dataFinal?: string;
}
