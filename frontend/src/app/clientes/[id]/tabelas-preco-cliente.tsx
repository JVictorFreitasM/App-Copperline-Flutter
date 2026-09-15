"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/badge";
import { associarTabelaPreco, desassociarTabelaPreco } from "./actions";

// OS-novas-implementacoes.md Bloco 1 - com 1 código associado, é "fixa"
// (nenhum vendedor escolhe); com 2+, todo vendedor que atende o cliente vê
// e escolhe entre elas (sem camada de restrição por vendedor - decisão
// confirmada). Aqui é só a tela ADMIN de gerenciar quais códigos existem
// pra esse cliente; o seletor do vendedor (quando ele monta pedido) fica
// pra quando existir um fluxo de criação de pedido no painel web.
export function TabelasPrecoCliente({
  clienteId,
  codigosIniciais,
  podeEditar,
}: {
  clienteId: string;
  codigosIniciais: string[];
  podeEditar: boolean;
}) {
  const [codigos, setCodigos] = useState(codigosIniciais);
  const [novoCodigo, setNovoCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function associar() {
    const codigo = novoCodigo.trim();
    if (!codigo || codigos.includes(codigo)) return;
    setErro(null);
    startTransition(async () => {
      try {
        await associarTabelaPreco(clienteId, codigo);
        setCodigos((atual) => [...atual, codigo]);
        setNovoCodigo("");
      } catch {
        setErro("Falha ao associar - confira o código e tente novamente.");
      }
    });
  }

  function desassociar(codigo: string) {
    setErro(null);
    startTransition(async () => {
      try {
        await desassociarTabelaPreco(clienteId, codigo);
        setCodigos((atual) => atual.filter((c) => c !== codigo));
      } catch {
        setErro("Falha ao remover - tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {codigos.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma tabela associada - usa a tabela global padrão do sistema.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {codigos.map((codigo) => (
            <span key={codigo} className="flex items-center gap-1">
              <Badge enfase={codigos.length === 1}>Tabela {codigo}</Badge>
              {podeEditar && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => desassociar(codigo)}
                  className="text-xs text-muted hover:text-ink"
                  aria-label={`Remover tabela ${codigo}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {codigos.length === 1 && (
        <p className="text-xs text-muted">Só 1 tabela associada - fica fixa, sem seletor.</p>
      )}

      {podeEditar && (
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Associar código de tabela
            <input
              type="text"
              value={novoCodigo}
              onChange={(evento) => setNovoCodigo(evento.target.value)}
              placeholder="ex: 205"
              className="w-32 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
            />
          </label>
          <button
            type="button"
            onClick={associar}
            disabled={pending || !novoCodigo.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
          >
            Associar
          </button>
        </div>
      )}
      {erro && <p className="text-xs font-medium text-muted">{erro}</p>}
    </div>
  );
}
