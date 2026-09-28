// Mesmo shape de backend/src/vendedores/vendedores-hierarquia.service.ts
// (VendedorListaDto) e do enum PapelVendedor (schema.prisma) - duplicado
// aqui por não haver pacote compartilhado entre front e back.
export type PapelVendedor = "VENDEDOR" | "SUPERVISOR" | "GERENTE";

export interface VendedorListaDto {
  id: string;
  nome: string | null;
  email: string | null;
  // NAO vem do WK Radar - cadastrado manualmente pelo admin (2026-09-28),
  // pro PDF de impressao do pedido (bloco "Vendedor(a)").
  whatsapp: string | null;
  inativo: boolean;
  papel: PapelVendedor;
  supervisorId: string | null;
  supervisorNome: string | null;
  // OS-novas-implementacoes.md Bloco 5 - default true em todo vendedor
  // (ver schema.prisma) ate' um admin desligar explicitamente pra exigir
  // agendamento previo de visita.
  permiteCheckinSemAgendamento: boolean;
}

export interface AtualizarHierarquiaInput {
  papel: PapelVendedor;
  supervisorId: string | null;
}

// Mesmo shape de backend/src/vendedores/vendedores.controller.ts
// (MeuVendedorDto, GET /vendedores/me) - usado só pra decidir se mostra o
// link "Aprovações" na navegação (podeAprovar), ver app-shell.tsx.
export interface MeuVendedorDto {
  vendedorId: string | null;
  papel: PapelVendedor | null;
  podeAprovar: boolean;
}

// Mesmo shape de backend/src/vendedores/vendedores-hierarquia.service.ts
// (VendedorEquipeDto, GET /vendedores/equipe) - só o roster (id/nome) da
// equipe de quem chama, usado pra popular o filtro por vendedor do painel
// de visitas (OS-WEB-26). Diferente de VendedorListaDto (lista completa,
// admin-only via ApiKeyGuard).
export interface VendedorEquipeDto {
  id: string;
  nome: string | null;
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
