import type { ReactNode } from "react";

// Badge com só dois tons - ink (enfase) e cinza neutro (background/muted) -
// não um por significado semântico (ver skill design-system: "preto/cinza
// para estados neutros, primary só se fizer sentido, não introduzir
// verde/vermelho sem necessidade real"). Quem decide qual estado merece
// destaque é o call site (ex: configSituacaoPedido em lib/pedidos.ts), não
// uma cor arbitrária passada aqui.
export function Badge({ enfase = false, children }: { enfase?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
        enfase ? "bg-ink text-white" : "bg-background text-muted"
      }`}
    >
      {children}
    </span>
  );
}

export function BadgeAtivoInativo({ inativo }: { inativo: boolean }) {
  return <Badge enfase={!inativo}>{inativo ? "Inativo" : "Ativo"}</Badge>;
}
