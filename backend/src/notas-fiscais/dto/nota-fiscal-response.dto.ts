import type {
  Cliente,
  NotaFiscal,
  NotaFiscalPedido,
  Pedido,
} from '../../../generated/prisma/client';

export interface ClienteResumoNotaFiscalDto {
  id: string;
  razaoSocial: string | null;
}

export interface PedidoResumoNotaFiscalDto {
  id: string;
  numero: string | null;
  cliente: ClienteResumoNotaFiscalDto | null;
}

// Mesmo shape pra lista e detalhe - nota fiscal nao tem um bloco adicional
// (tipo itens de pedido) que so faca sentido no detalhe; os pedidos
// vinculados ja aparecem em ambos (ver criterio de aceite da OS).
export interface NotaFiscalDto {
  id: string;
  idExternoErp: string;
  chave: string | null;
  tipo: string | null;
  numero: number | null;
  serie: string | null;
  dataEmissao: Date | null;
  statusNfe: string | null;
  nfseGerada: boolean | null;
  nfseCancelada: boolean | null;
  valorTotalNotaFiscal: string | null;
  sincronizadoEm: Date;
  pedidos: PedidoResumoNotaFiscalDto[];
}

type NotaFiscalComPedidos = NotaFiscal & {
  pedidos: (NotaFiscalPedido & {
    pedido: Pedido & { cliente: Cliente | null };
  })[];
};

export function paraNotaFiscalDto(nota: NotaFiscalComPedidos): NotaFiscalDto {
  return {
    id: nota.id,
    idExternoErp: nota.idExternoErp,
    chave: nota.chave,
    tipo: nota.tipo,
    numero: nota.numero,
    serie: nota.serie,
    dataEmissao: nota.dataEmissao,
    statusNfe: nota.statusNfe,
    nfseGerada: nota.nfseGerada,
    nfseCancelada: nota.nfseCancelada,
    valorTotalNotaFiscal: nota.valorTotalNotaFiscal?.toString() ?? null,
    sincronizadoEm: nota.sincronizadoEm,
    pedidos: nota.pedidos.map(({ pedido }) => ({
      id: pedido.id,
      numero: pedido.numero,
      cliente: pedido.cliente
        ? { id: pedido.cliente.id, razaoSocial: pedido.cliente.razaoSocial }
        : null,
    })),
  };
}
