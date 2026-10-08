// Mesmo shape de backend/src/acessos/acessos.service.ts (ContaAcessoDto).
export interface SessaoAtivaDto {
  id: string;
  plataforma: "mobile" | "web" | "desconhecida";
  dispositivo: string;
  ip: string | null;
  criadoEm: string;
  ultimoAcessoEm: string;
}

export interface ContaAcessoDto {
  id: string;
  nome: string;
  email: string;
  bloqueado: boolean;
  bloqueadoEm: string | null;
  motivoBloqueio: string | null;
  dispositivosPush: number;
  sessoes: SessaoAtivaDto[];
}
