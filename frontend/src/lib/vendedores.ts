// Mesmo shape de backend/src/vendedores/vendedores-hierarquia.service.ts
// (VendedorListaDto) e do enum PapelVendedor (schema.prisma) - duplicado
// aqui por não haver pacote compartilhado entre front e back.
export type PapelVendedor = "VENDEDOR" | "SUPERVISOR" | "GERENTE";

export interface VendedorListaDto {
  id: string;
  nome: string | null;
  email: string | null;
  inativo: boolean;
  papel: PapelVendedor;
  supervisorId: string | null;
  supervisorNome: string | null;
}

export interface AtualizarHierarquiaInput {
  papel: PapelVendedor;
  supervisorId: string | null;
}

// Mesmo shape de backend/src/vendedores/vendedores.controller.ts
// (MeuVendedorDto, GET /vendedores/me) - usado só pra decidir se mostra o
// link "Aprovações" na navegação (podeAprovar), ver site-header.tsx.
export interface MeuVendedorDto {
  vendedorId: string | null;
  papel: PapelVendedor | null;
  podeAprovar: boolean;
}

const ROTULOS_PAPEL: Record<PapelVendedor, string> = {
  VENDEDOR: "Vendedor",
  SUPERVISOR: "Supervisor",
  GERENTE: "Gerente",
};

export function rotuloPapel(papel: PapelVendedor): string {
  return ROTULOS_PAPEL[papel];
}

export const OPCOES_PAPEL: { valor: PapelVendedor; rotulo: string }[] = (
  Object.entries(ROTULOS_PAPEL) as [PapelVendedor, string][]
).map(([valor, rotulo]) => ({ valor, rotulo }));
