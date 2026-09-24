"use client";

import { useActionState, useRef, useState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { buscarClientes } from "@/app/pedidos/novo/actions";
import type { OpcaoBusca } from "@/app/pedidos/novo/tipos";
import { criarAgendamento } from "./actions";
import type { EstadoCriarAgendamento } from "./actions";

const ESTADO_INICIAL: EstadoCriarAgendamento = { erro: null, sucesso: null };
const DEBOUNCE_MS = 300;

// Busca de cliente reaproveitada de CriarPedidoForm (pedidos/novo) - mesmo
// server action (GET /clientes?nome=, ja escopado por vendedor), evita
// duplicar a mesma chamada so pra este formulario menor.
export function CriarAgendamentoForm() {
  const [estado, acao, pending] = useActionState(criarAgendamento, ESTADO_INICIAL);

  const [clienteQuery, setClienteQuery] = useState("");
  const [opcoes, setOpcoes] = useState<OpcaoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState<OpcaoBusca | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onMudarQuery(valor: string) {
    setClienteQuery(valor);
    setCliente(null);
    if (timer.current) clearTimeout(timer.current);
    if (!valor.trim()) {
      setOpcoes([]);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      setOpcoes(await buscarClientes(valor));
      setBuscando(false);
    }, DEBOUNCE_MS);
  }

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="clienteId" value={cliente?.id ?? ""} />
      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Cliente
          <input
            type="text"
            value={clienteQuery}
            onChange={(evento) => onMudarQuery(evento.target.value)}
            placeholder="Buscar por nome..."
            className="w-56 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        {!cliente &&
          (buscando ? (
            <p className="text-xs text-muted">Buscando...</p>
          ) : (
            opcoes.length > 0 && (
              <ul className="flex flex-col gap-1">
                {opcoes.map((opcao) => (
                  <li key={opcao.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCliente(opcao);
                        setClienteQuery(opcao.label);
                        setOpcoes([]);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-background"
                    >
                      {opcao.label}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ))}
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Data
        <input
          type="date"
          name="data"
          className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Hora
        <input
          type="time"
          name="hora"
          className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <PrimaryButton type="submit" disabled={pending || !cliente}>
        {pending ? "Agendando..." : "Agendar"}
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
