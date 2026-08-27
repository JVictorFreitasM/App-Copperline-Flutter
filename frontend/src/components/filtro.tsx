import type { ReactNode } from "react";
import Form from "next/form";
import Link from "next/link";
import { Card } from "./design/card";
import { PrimaryButton } from "./design/button";

// next/form (nao <form> nativo) - reflete o filtro na URL sem precisar de
// nenhum JS no cliente pra funcionar (ver critério de aceite da OS-WEB-15:
// filtro compartilhável/voltável pela URL), mas ao submeter faz navegação
// client-side em vez de reload completo de pagina (OS-WEB-28: <form
// method="get"> nativo forcava reload de documento inteiro a cada filtro -
// next/form preserva o comportamento de URL mas sem esse reload).
// scroll={false} evita pular pro topo da pagina ao filtrar (mesmo criterio
// de aceite). Submeter sem `page` reinicia a listagem na página 1, que é o
// comportamento esperado ao trocar de filtro. Card + PrimaryButton + link
// em `primary` (OS-WEB-16, design-system).
export function FiltroForm({ rota, children }: { rota: string; children: ReactNode }) {
  return (
    <Card>
      <Form action={rota} scroll={false} className="flex flex-wrap items-end gap-3">
        {children}
        <PrimaryButton type="submit">Filtrar</PrimaryButton>
        <Link href={rota} scroll={false} className="px-1 text-sm font-medium text-primary hover:underline">
          Limpar filtros
        </Link>
      </Form>
    </Card>
  );
}

export function CampoFiltro({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: "text" | "date";
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
      />
    </label>
  );
}
