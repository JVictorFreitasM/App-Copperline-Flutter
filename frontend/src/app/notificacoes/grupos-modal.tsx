"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/design/modal";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import type { DestinatarioMensagemDto, GrupoMensagemDto } from "@/lib/mensagens";
import { atualizarGrupo, criarGrupo, removerGrupo } from "./mensagens-actions";

const CLASSE_CAMPO =
  "w-full rounded-2xl bg-background px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light";

// Grupos de destinatários das mensagens (lista nomeada de vendedores,
// independente da hierarquia supervisor->vendedor). Vive na mesma tela de
// Notificações, ao lado de "Nova mensagem".
export function GruposModal({
  open,
  onClose,
  vendedores,
  grupos,
}: {
  open: boolean;
  onClose: () => void;
  vendedores: DestinatarioMensagemDto[];
  grupos: GrupoMensagemDto[];
}) {
  const router = useRouter();
  // null = lista; "novo" = criando; id = editando aquele grupo.
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [nome, setNome] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const vendedoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? vendedores.filter((v) => v.nome.toLowerCase().includes(termo)) : vendedores;
  }, [vendedores, busca]);

  const nomePorVendedor = useMemo(
    () => new Map(vendedores.map((vendedor) => [vendedor.id, vendedor.nome])),
    [vendedores],
  );

  function abrirEdicao(grupo: GrupoMensagemDto | null) {
    setErro(null);
    setBusca("");
    setNome(grupo?.nome ?? "");
    setSelecionados(new Set(grupo?.vendedorIds ?? []));
    setEditando(grupo?.id ?? "novo");
  }

  function voltarParaLista() {
    setErro(null);
    setEditando(null);
  }

  function fechar() {
    if (pending) return;
    voltarParaLista();
    onClose();
  }

  function alternar(vendedorId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (!proximo.delete(vendedorId)) proximo.add(vendedorId);
      return proximo;
    });
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const ids = [...selecionados];
      const resultado =
        editando === "novo"
          ? await criarGrupo(nome.trim(), ids)
          : await atualizarGrupo(editando as string, nome.trim(), ids);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
      setEditando(null);
    });
  }

  function remover(grupo: GrupoMensagemDto) {
    if (!window.confirm(`Remover o grupo "${grupo.nome}"? As mensagens já enviadas continuam no histórico.`)) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const resultado = await removerGrupo(grupo.id);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  const emEdicao = editando !== null;

  return (
    <Modal
      open={open}
      onClose={fechar}
      title={emEdicao ? (editando === "novo" ? "Novo grupo" : "Editar grupo") : "Grupos de vendedores"}
      largura="max-w-2xl"
      footer={
        emEdicao ? (
          <div className="flex items-center justify-between gap-4">
            <p className="min-h-5 text-sm text-accent-red" role="status">
              {erro}
            </p>
            <div className="flex gap-3">
              <SecondaryButton type="button" disabled={pending} onClick={voltarParaLista}>
                Voltar
              </SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={pending || nome.trim().length === 0 || selecionados.size === 0}
                onClick={salvar}
              >
                {pending ? "Salvando..." : "Salvar grupo"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="min-h-5 text-sm text-accent-red" role="status">
              {erro}
            </p>
            <PrimaryButton type="button" onClick={() => abrirEdicao(null)}>
              Novo grupo
            </PrimaryButton>
          </div>
        )
      }
    >
      {emEdicao ? (
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Nome do grupo
            <input
              type="text"
              value={nome}
              maxLength={60}
              onChange={(evento) => setNome(evento.target.value)}
              className={CLASSE_CAMPO}
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted">
                Vendedores ({selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"})
              </span>
              <input
                type="search"
                value={busca}
                placeholder="Buscar..."
                onChange={(evento) => setBusca(evento.target.value)}
                className="w-48 rounded-full bg-background px-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto rounded-2xl bg-background p-2">
              {vendedoresFiltrados.map((vendedor) => (
                <li key={vendedor.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface">
                    <input
                      type="checkbox"
                      checked={selecionados.has(vendedor.id)}
                      onChange={() => alternar(vendedor.id)}
                    />
                    <span className="flex-1">{vendedor.nome}</span>
                    {!vendedor.comApp && (
                      <span className="text-xs text-muted">sem app vinculado</span>
                    )}
                  </label>
                </li>
              ))}
              {vendedoresFiltrados.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted">Nenhum vendedor encontrado.</li>
              )}
            </ul>
          </div>
        </div>
      ) : grupos.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Nenhum grupo criado ainda. Crie um para enviar a mesma mensagem a vários vendedores de uma vez.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grupos.map((grupo) => (
            <li
              key={grupo.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{grupo.nome}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {grupo.vendedorIds.length} vendedor{grupo.vendedorIds.length === 1 ? "" : "es"}
                  {": "}
                  {grupo.vendedorIds
                    .map((id) => nomePorVendedor.get(id) ?? "(inativo)")
                    .slice(0, 4)
                    .join(", ")}
                  {grupo.vendedorIds.length > 4 ? "..." : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <SecondaryButton type="button" disabled={pending} onClick={() => abrirEdicao(grupo)}>
                  Editar
                </SecondaryButton>
                <SecondaryButton type="button" disabled={pending} onClick={() => remover(grupo)}>
                  Remover
                </SecondaryButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
