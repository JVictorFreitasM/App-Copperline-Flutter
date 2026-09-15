import type { Produto } from '../../../generated/prisma/client';

export interface ProdutoResumoDto {
  id: string;
  idExternoErp: string;
  codigo: string | null;
  nome: string | null;
  tipo: string | null;
  inativo: boolean;
  precoVenda: string | null;
  gtin: string | null;
  incompleto: boolean;
  sincronizadoEm: Date;
}

export interface ProdutoDetalheDto extends ProdutoResumoDto {
  idGrade1: string | null;
  idGrade2: string | null;
  idGrade3: string | null;
  referenciasGrade: unknown;
  // tipoVenda (OS-BACKEND-24): campo legado, NAO usado mais pelo calculo
  // de quantidade (ver OS-novas-implementacoes.md Bloco 4, revisao) - a
  // regra POC/RET/KM nunca foi definida e o campo sempre vem null na
  // pratica; quem decide o bloqueio hoje e' tipoAcondicionamento.tamanhoPadrao.
  // Mantido exposto so' por retrocompatibilidade, sem uso funcional.
  tipoVenda: string | null;
  comprimentoMetros: string | null;
  // Nao vem do WK Radar (dado proprio, editavel via PATCH
  // /admin/produtos/:id) - ver comentario no schema.prisma.
  precoFabricacao: string | null;
  temImagem: boolean;
  tipoAcondicionamentoId: string | null;
  // OS-novas-implementacoes.md Bloco 3 - vem do WK Radar (só confiável
  // quando a unidade sincronizada é "kg", ver UNIDADE_MEDIDA_KG em
  // produto.sync.ts); null quando o ERP não informa peso pra este produto.
  pesoLiquidoKg: string | null;
  pesoBrutoKg: string | null;
}

// precoTabela (pedido do usuario: "coloque o preço de venda vindo da
// tabela no preço do produto") - quando existe um item pra este produto
// na TABELA PADRAO (ver PrecoProdutoService), ele SUBSTITUI
// Produto.precoVenda cru como o preço exibido. Sem tabela padrão
// definida, ou sem item pra este código nela, cai de volta pro
// precoVenda sincronizado do cadastro (nunca fica sem preço por causa
// disso).
export function paraProdutoResumoDto(
  produto: Produto,
  precoTabela?: string,
): ProdutoResumoDto {
  return {
    id: produto.id,
    idExternoErp: produto.idExternoErp,
    codigo: produto.codigo,
    nome: produto.nome,
    tipo: produto.tipo,
    inativo: produto.inativo,
    precoVenda: precoTabela ?? produto.precoVenda?.toString() ?? null,
    gtin: produto.gtin,
    incompleto: produto.incompleto,
    sincronizadoEm: produto.sincronizadoEm,
  };
}

export function paraProdutoDetalheDto(
  produto: Produto,
  precoTabela?: string,
): ProdutoDetalheDto {
  return {
    ...paraProdutoResumoDto(produto, precoTabela),
    idGrade1: produto.idGrade1,
    idGrade2: produto.idGrade2,
    idGrade3: produto.idGrade3,
    referenciasGrade: produto.referenciasGrade,
    tipoVenda: produto.tipoVenda,
    comprimentoMetros: produto.comprimentoMetros?.toString() ?? null,
    precoFabricacao: produto.precoFabricacao?.toString() ?? null,
    temImagem: produto.imagemCaminho !== null,
    tipoAcondicionamentoId: produto.tipoAcondicionamentoId,
    pesoLiquidoKg: produto.pesoLiquidoKg?.toString() ?? null,
    pesoBrutoKg: produto.pesoBrutoKg?.toString() ?? null,
  };
}
