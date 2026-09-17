// Tipos/estado do formulário de criação de pedido - fora de actions.ts de
// proposito (Next.js: um arquivo "use server" só pode exportar funções
// async, ver estado-edicao-manual.ts em produtos/[id] pro mesmo padrão).
export interface OpcaoBusca {
  id: string;
  label: string;
}

// Item já confirmado no popup de detalhe (img.jpeg) - unifica o que antes
// era um card inline com campos soltos. metrosDesejados em KM (mesma
// convenção já usada no resto da tela: convertido pra metros só na
// chamada da API).
export interface ItemPedidoState {
  chave: string;
  produto: OpcaoBusca;
  metrosDesejados: number;
  percentualDesconto: number;
  observacoes: string;
  quantidade: number;
  unidade: string;
  valorUnitarioBruto: number;
  valorFinal: number;
  estoqueDisponivel: number | null;
}

export interface EstadoCriarPedido {
  status: "idle" | "sucesso" | "erro";
  pedidoId?: string;
  situacaoPedido?: "ENVIADO" | "AGUARDANDO_APROVACAO";
  mensagem?: string;
}

export const ESTADO_CRIAR_PEDIDO_INICIAL: EstadoCriarPedido = { status: "idle" };
