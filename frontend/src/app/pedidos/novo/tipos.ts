// Tipos/estado do formulário de criação de pedido - fora de actions.ts de
// proposito (Next.js: um arquivo "use server" só pode exportar funções
// async, ver estado-edicao-manual.ts em produtos/[id] pro mesmo padrão).
export interface OpcaoBusca {
  id: string;
  label: string;
}

export interface ItemFormulario {
  chave: string;
  produtoId: string | null;
  produtoLabel: string;
  metrosDesejados: string;
}

export interface EstadoCriarPedido {
  status: "idle" | "sucesso" | "erro";
  pedidoId?: string;
  situacaoPedido?: "ENVIADO" | "AGUARDANDO_APROVACAO";
  mensagem?: string;
}

export const ESTADO_CRIAR_PEDIDO_INICIAL: EstadoCriarPedido = { status: "idle" };
