"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/design/modal";
import { buscarProdutos } from "./actions";
import type { OpcaoBusca } from "./tipos";

const DEBOUNCE_MS = 300;

// Popup de seleção de produto (referência do usuário, "popup selecionar
// item.jpg") - lista com busca, abre o ItemDetalhePopup ao clicar num
// produto. So' a aba "Produtos" (sem "Campanhas" - decisão confirmada,
// não existe conceito de campanha promocional no backend hoje).
export function SelecionarItemPopup({
  open,
  onCancelar,
  onSelecionarProduto,
}: {
  open: boolean;
  onCancelar: () => void;
  onSelecionarProduto: (produto: OpcaoBusca) => void;
}) {
  const [query, setQuery] = useState("");
  const [opcoes, setOpcoes] = useState<OpcaoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onMudarQuery(valor: string) {
    setQuery(valor);
    if (timer.current) clearTimeout(timer.current);
    if (!valor.trim()) {
      setOpcoes([]);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      const resultado = await buscarProdutos(valor);
      setOpcoes(resultado);
      setBuscando(false);
    }, DEBOUNCE_MS);
  }

  return (
    <Modal open={open} onClose={onCancelar} title="Selecionar produto">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(evento) => onMudarQuery(evento.target.value)}
            placeholder="Filtrar produtos por nome ou código..."
            autoFocus
            className="flex-1 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
          <label
            className="flex items-center gap-2 text-xs text-muted opacity-50"
            title="Ainda não implementado - precisa de um filtro novo no backend pra listar por promoção"
          >
            <input type="checkbox" disabled />
            Produtos em promoção
          </label>
        </div>

        {buscando ? (
          <p className="text-xs text-muted">Buscando...</p>
        ) : opcoes.length === 0 ? (
          <p className="text-xs text-muted">
            {query.trim() ? "Nenhum produto encontrado." : "Digite pra buscar um produto."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {opcoes.map((opcao) => (
              <li key={opcao.id}>
                <button
                  type="button"
                  onClick={() => onSelecionarProduto(opcao)}
                  className="w-full px-2 py-3 text-left text-sm text-ink hover:bg-background"
                >
                  {opcao.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
