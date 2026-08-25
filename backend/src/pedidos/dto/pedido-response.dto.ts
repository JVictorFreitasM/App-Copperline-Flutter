import type {
  Cliente,
  Pedido,
  PedidoItem,
  Produto,
} from '../../../generated/prisma/client';

export interface ClienteResumoPedidoDto {
  id: string;
  razaoSocial: string | null;
}

// Resumo de listagem - sem os itens (arvore de pedido pode ser grande, ver
// criterio de aceite da OS 11 sobre nao vazar dado irrelevante numa lista).
export interface PedidoResumoDto {
  id: string;
  idExternoErp: string | null;
  numero: string | null;
  situacao: string | null;
  dataHoraUltimaAlteracao: Date | null;
  valorTotal: string | null;
  incompleto: boolean;
  sincronizadoEm: Date;
  cliente: ClienteResumoPedidoDto | null;
}

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

export function paraClienteResumoPedidoDto(
  cliente: Cliente | null,
): ClienteResumoPedidoDto | null {
  return cliente ? { id: cliente.id, razaoSocial: cliente.razaoSocial } : null;
}

export function paraPedidoResumoDto(
  pedido: Pedido & { cliente: Cliente | null },
): PedidoResumoDto {
  return {
    id: pedido.id,
    idExternoErp: pedido.idExternoErp,
    numero: pedido.numero,
    situacao: pedido.situacao,
    dataHoraUltimaAlteracao: pedido.dataHoraUltimaAlteracao,
    valorTotal: pedido.valorTotal?.toString() ?? null,
    incompleto: pedido.incompleto,
    sincronizadoEm: pedido.sincronizadoEm,
    cliente: paraClienteResumoPedidoDto(pedido.cliente),
  };
}

export function paraPedidoDetalheDto(
  pedido: Pedido & {
    cliente: Cliente | null;
    itens: (PedidoItem & { produto: Produto | null })[];
  },
): PedidoDetalheDto {
  return {
    ...paraPedidoResumoDto(pedido),
    itens: pedido.itens.map((item) => ({
      id: item.id,
      numero: item.numero,
      idItemGrade1: item.idItemGrade1,
      idItemGrade2: item.idItemGrade2,
      idItemGrade3: item.idItemGrade3,
      quantidadeVenda: item.quantidadeVenda?.toString() ?? null,
      valorUnitario: item.valorUnitario?.toString() ?? null,
      valorTotal: item.valorTotal?.toString() ?? null,
      situacao: item.situacao,
      produto: item.produto
        ? {
            id: item.produto.id,
            nome: item.produto.nome,
            codigo: item.produto.codigo,
          }
        : null,
    })),
  };
}
