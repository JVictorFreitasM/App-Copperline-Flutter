import type { Cliente, Pedido, SolicitacaoDesconto } from '../../../generated/prisma/client';

export type StatusAprovacaoPedido = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'ENVIADO' | null;

// Pedido dentro do relatorio (OS-WEB-27) - statusAprovacao deriva do
// pipeline de aprovacao de desconto (SolicitacaoDesconto.status), NAO de
// Pedido.statusLocal isolado: statusLocal so e' gravado na criacao e nunca
// atualizado depois (nem quando a solicitacao e' decidida - ver
// relatorio-pedidos.service.ts), entao usar so ele mostraria um pedido
// como "aguardando aprovacao" pra sempre mesmo depois de aprovado/rejeitado.
// null = pedido sem pipeline de aprovacao (sincronizado do ERP, nunca
// passou por POST /pedidos local, ou enviado direto sem exigir aprovacao).
export interface RelatorioPedidoItemDto {
  id: string;
  numero: string | null;
  situacao: string | null;
  statusAprovacao: StatusAprovacaoPedido;
  // Só preenchido quando statusAprovacao === 'PENDENTE' - dias corridos
  // desde dataHoraUltimaAlteracao. destaquePendenciaAntiga (>1 dia) já vem
  // calculado aqui - o front não reimplementa o corte (critério geral do
  // projeto: sem cálculo duplicado no front, mesmo padrão de OS-WEB-22/23).
  diasPendente: number | null;
  destaquePendenciaAntiga: boolean;
  dataHoraUltimaAlteracao: string | null;
  valorTotal: string | null;
  cliente: { id: string; razaoSocial: string | null } | null;
}

export interface RelatorioVendedorDto {
  vendedorId: string;
  vendedorNome: string | null;
  totalPedidos: number;
  // Contagem de PENDENTE agora (não histórico do período) - "útil pra
  // identificar gargalo de aprovação" (critério de aceite), sempre reflete
  // o estado atual da fila desse vendedor, independente do filtro de
  // período aplicado à lista de pedidos abaixo.
  pendentesAtuais: number;
  pedidos: RelatorioPedidoItemDto[];
}

export interface RelatorioPedidosDto {
  // null quando o filtro correspondente foi omitido (intervalo aberto) -
  // só os dois viram "hoje" quando NENHUM dos dois é informado (ver
  // RelatorioPedidosService.obter, "pedidos do dia (ou período
  // selecionado)").
  periodo: { dataInicial: string | null; dataFinal: string | null };
  vendedores: RelatorioVendedorDto[];
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function calcularStatusAprovacao(
  pedido: Pick<Pedido, 'statusLocal'> & {
    solicitacoesDesconto: Pick<SolicitacaoDesconto, 'status'>[];
  },
): StatusAprovacaoPedido {
  if (pedido.statusLocal === 'ENVIADO') {
    return 'ENVIADO';
  }
  if (pedido.statusLocal !== 'AGUARDANDO_APROVACAO') {
    return null;
  }
  // Uma solicitacao por pedido na pratica (ver criar-pedido.service.ts) -
  // pega a mais recente se por algum motivo houver mais de uma.
  const solicitacao = pedido.solicitacoesDesconto[0];
  return solicitacao?.status ?? 'PENDENTE';
}

export function paraRelatorioPedidoItemDto(
  pedido: Pedido & {
    cliente: Cliente | null;
    solicitacoesDesconto: Pick<SolicitacaoDesconto, 'status'>[];
  },
  agora: Date,
): RelatorioPedidoItemDto {
  const statusAprovacao = calcularStatusAprovacao(pedido);
  const pendente = statusAprovacao === 'PENDENTE' && pedido.dataHoraUltimaAlteracao !== null;
  const diasPendente = pendente
    ? Math.floor(
        (agora.getTime() - pedido.dataHoraUltimaAlteracao!.getTime()) / UM_DIA_MS,
      )
    : null;

  return {
    id: pedido.id,
    numero: pedido.numero,
    situacao: pedido.situacao,
    statusAprovacao,
    diasPendente,
    destaquePendenciaAntiga: diasPendente !== null && diasPendente > 1,
    dataHoraUltimaAlteracao: pedido.dataHoraUltimaAlteracao
      ? pedido.dataHoraUltimaAlteracao.toISOString()
      : null,
    valorTotal: pedido.valorTotal?.toString() ?? null,
    cliente: pedido.cliente
      ? { id: pedido.cliente.id, razaoSocial: pedido.cliente.razaoSocial }
      : null,
  };
}
