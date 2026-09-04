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
  // tipoVenda/comprimentoMetros (OS-BACKEND-24) expostos aqui pra
  // OS-WEB-22 poder mostrar o badge POC/RET/KM e o contexto de por que uma
  // simulação (POST /:id/calcular) falhou (ex: "sem tipoVenda
  // configurado") - ainda sem regra de classificação automática definida
  // (ver PENDENCIA em schema.prisma), então normalmente vem null hoje.
  tipoVenda: string | null;
  comprimentoMetros: string | null;
  // Nao vem do WK Radar (dado proprio, editavel via PATCH
  // /admin/produtos/:id) - ver comentario no schema.prisma.
  precoFabricacao: string | null;
  temImagem: boolean;
}

export function paraProdutoResumoDto(produto: Produto): ProdutoResumoDto {
  return {
    id: produto.id,
    idExternoErp: produto.idExternoErp,
    codigo: produto.codigo,
    nome: produto.nome,
    tipo: produto.tipo,
    inativo: produto.inativo,
    precoVenda: produto.precoVenda?.toString() ?? null,
    gtin: produto.gtin,
    incompleto: produto.incompleto,
    sincronizadoEm: produto.sincronizadoEm,
  };
}

export function paraProdutoDetalheDto(produto: Produto): ProdutoDetalheDto {
  return {
    ...paraProdutoResumoDto(produto),
    idGrade1: produto.idGrade1,
    idGrade2: produto.idGrade2,
    idGrade3: produto.idGrade3,
    referenciasGrade: produto.referenciasGrade,
    tipoVenda: produto.tipoVenda,
    comprimentoMetros: produto.comprimentoMetros?.toString() ?? null,
    precoFabricacao: produto.precoFabricacao?.toString() ?? null,
    temImagem: produto.imagemCaminho !== null,
  };
}
