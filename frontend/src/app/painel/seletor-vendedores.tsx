"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PrimaryButton } from "@/components/design/button";

interface Vendedor {
  id: string;
  nome: string;
}

// Seletor do "Comparativo de vendedores": busca por nome + lista rolavel com
// os vendedores (em vez de 40 caixas soltas), os escolhidos aparecem como
// "chips" removiveis e o botao Comparar so liga com 2 a 4 escolhidos.
//
// Por que existe (bug anterior): o <form> GET mandava um parametro
// `vendedorIds` POR vendedor marcado (?vendedorIds=a&vendedorIds=b), mas a
// pagina e a API esperam UMA string separada por virgula - com 2 ou mais
// marcados o Next entregava um array e a pagina quebrava no .split(). Aqui a
// URL e' montada explicitamente (vendedorIds=a,b) e os outros filtros (periodo,
// equipe) sao preservados.
export function SeletorVendedores({
  vendedores,
  selecionadosIniciais,
  minimo,
  maximo,
}: {
  vendedores: Vendedor[];
  selecionadosIniciais: string[];
  minimo: number;
  maximo: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selecionados, setSelecionados] = useState<string[]>(selecionadosIniciais);
  const [busca, setBusca] = useState("");

  const porId = useMemo(() => new Map(vendedores.map((v) => [v.id, v])), [vendedores]);
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return vendedores.filter((v) => !termo || v.nome.toLowerCase().includes(termo));
  }, [vendedores, busca]);

  const limiteAtingido = selecionados.length >= maximo;
  const podeComparar = selecionados.length >= minimo && selecionados.length <= maximo;

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : atual.length < maximo ? [...atual, id] : atual,
    );
  }

  function comparar() {
    const proximos = new URLSearchParams(parametros.toString());
    proximos.set("vendedorIds", selecionados.join(","));
    startTransition(() => {
      router.push(`${pathname}?${proximos.toString()}`, { scroll: false });
    });
  }

  function limpar() {
    setSelecionados([]);
    const proximos = new URLSearchParams(parametros.toString());
    if (proximos.has("vendedorIds")) {
      proximos.delete("vendedorIds");
      startTransition(() => {
        router.push(`${pathname}${proximos.size ? `?${proximos.toString()}` : ""}`, { scroll: false });
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Escolha de {minimo} a {maximo} vendedores para comparar ({selecionados.length} de {maximo}{" "}
        selecionados).
      </p>

      {selecionados.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selecionados.map((id) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-full bg-solid py-1 pr-2 pl-3 text-sm text-on-solid"
            >
              {porId.get(id)?.nome ?? "—"}
              <button
                type="button"
                onClick={() => alternar(id)}
                aria-label={`Remover ${porId.get(id)?.nome ?? "vendedor"}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-xs hover:bg-white/20"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        value={busca}
        onChange={(evento) => setBusca(evento.target.value)}
        placeholder="Buscar vendedor"
        className="w-full max-w-sm rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
      />

      <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-card bg-background p-2 sm:grid-cols-2 lg:grid-cols-3">
        {visiveis.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nenhum vendedor encontrado.</li>}
        {visiveis.map((vendedor) => {
          const marcado = selecionados.includes(vendedor.id);
          const bloqueado = !marcado && limiteAtingido;
          return (
            <li key={vendedor.id}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  marcado ? "bg-primary-light font-medium text-primary" : "text-ink hover:bg-surface"
                } ${bloqueado ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={bloqueado}
                  onChange={() => alternar(vendedor.id)}
                />
                <span className="truncate">{vendedor.nome}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" onClick={comparar} disabled={!podeComparar || pending}>
          {pending ? "Comparando..." : "Comparar"}
        </PrimaryButton>
        {selecionados.length > 0 && (
          <button type="button" onClick={limpar} className="text-sm text-muted hover:text-ink">
            Limpar seleção
          </button>
        )}
        {selecionados.length > 0 && selecionados.length < minimo && (
          <span className="text-xs text-muted">Escolha mais {minimo - selecionados.length} para comparar.</span>
        )}
      </div>
    </div>
  );
}
