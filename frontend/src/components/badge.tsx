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
        enfase ? "bg-solid text-on-solid" : "bg-background text-muted"
      }`}
    >
      {children}
    </span>
  );
}

// Cliente cadastrado por nós (POST /clientes) ainda não aceito pelo WK Radar:
// PENDENTE (na fila) ou ERRO (o ERP recusou - ver erroEnvioErp). ENVIADO não
// mostra nada (é o estado normal de todo cliente do sync).
export function BadgeStatusEnvioErp({
  status,
}: {
  status: "PENDENTE" | "ENVIADO" | "ERRO";
}) {
  if (status === "ENVIADO") return null;
  return <Badge enfase={status === "ERRO"}>{status === "ERRO" ? "Erro no envio ao ERP" : "Pendente de envio ao ERP"}</Badge>;
}

// Edição de cliente ainda não aplicada no WK Radar.
export function BadgeAlteracaoErp({
  alteracao,
}: {
  alteracao: { status: "PENDENTE" | "ERRO" } | null;
}) {
  if (!alteracao) return null;
  return (
    <Badge enfase={alteracao.status === "ERRO"}>
      {alteracao.status === "ERRO" ? "Erro ao enviar alteração ao ERP" : "Alteração pendente de envio ao ERP"}
    </Badge>
  );
}

export function BadgeAtivoInativo({ inativo }: { inativo: boolean }) {
  return <Badge enfase={!inativo}>{inativo ? "Inativo" : "Ativo"}</Badge>;
}
