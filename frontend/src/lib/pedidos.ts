// Mesmo shape de backend/src/pedidos/dto/pedido-response.dto.ts
// (PedidoResumoDto/ClienteResumoPedidoDto) - duplicado aqui por não haver
// pacote compartilhado entre front e back. GET /pedidos já inclui o
// cliente (nome resolvido via `include: { cliente: true }` no
// PedidosService) - não precisa de uma segunda chamada/join no front.
export interface ClienteResumoPedidoDto {
  id: string;
  razaoSocial: string | null;
}

export interface PedidoResumoDto {
  id: string;
  idExternoErp: string;
  numero: string | null;
  situacao: string | null;
  dataHoraUltimaAlteracao: string | null;
  valorTotal: string | null;
  incompleto: boolean;
  sincronizadoEm: string;
  cliente: ClienteResumoPedidoDto | null;
}

// Valores possíveis vêm do enum TipoSituacaoPedido do backend
// (schema.prisma). Só dois tons (ver skill design-system: "preto/cinza
// para estados neutros... não introduzir verde/vermelho sem necessidade
// real") - `enfase` destaca só o que já concluiu (faturado/atendido),
// tudo mais fica no chip neutro. Não é mais um mapa "uma cor por status".
const CONFIG_SITUACAO: Record<string, { rotulo: string; enfase: boolean }> = {
  EM_ANALISE: { rotulo: "Em análise", enfase: false },
  BLOQUEADO: { rotulo: "Bloqueado", enfase: false },
  PENDENTE: { rotulo: "Pendente", enfase: false },
  CANCELADO: { rotulo: "Cancelado", enfase: false },
  PARCIALMENTE_FATURADO: { rotulo: "Parcialmente faturado", enfase: false },
  FATURADO: { rotulo: "Faturado", enfase: true },
  PARCIALMENTE_ATENDIDO: { rotulo: "Parcialmente atendido", enfase: false },
  ATENDIDO: { rotulo: "Atendido", enfase: true },
};

export function configSituacaoPedido(situacao: string | null): {
  rotulo: string;
  enfase: boolean;
} {
  if (!situacao) {
    return { rotulo: "—", enfase: false };
  }
  return CONFIG_SITUACAO[situacao] ?? { rotulo: situacao, enfase: false };
}

// Opções pro <select> de filtro por situação (OS-WEB-15) - mesmos valores
// que o backend aceita em ListarPedidosQueryDto.situacao (enum
// TipoSituacaoPedido), na mesma ordem/rótulo de CONFIG_SITUACAO acima.
export const OPCOES_SITUACAO_PEDIDO = Object.entries(CONFIG_SITUACAO).map(
  ([valor, { rotulo }]) => ({ valor, rotulo }),
);

export interface ProdutoResumoPedidoDto {
  id: string;
  nome: string | null;
  codigo: string | null;
}

export interface PedidoItemDto {
  id: string;
  numero: number;
  idItemGrade1: string | null;
  idItemGrade2: string | null;
  idItemGrade3: string | null;
  quantidadeVenda: string | null;
  valorUnitario: string | null;
  valorTotal: string | null;
  situacao: string | null;
  produto: ProdutoResumoPedidoDto | null;
}

export interface PedidoDetalheDto extends PedidoResumoDto {
  itens: PedidoItemDto[];
}
