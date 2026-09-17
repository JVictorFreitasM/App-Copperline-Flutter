"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/design/modal";
import type { ContatoClienteDto } from "@/lib/clientes";
import { criarContatoCliente } from "./actions";

// Contato criado por nós (nunca sincroniza pro WK Radar, ver
// ContatoCliente.criadoLocalmente no backend) - popup simples, só nome
// obrigatório.
export function AdicionarContatoPopup({
  open,
  clienteId,
  onCancelar,
  onCriado,
}: {
  open: boolean;
  clienteId: string | null;
  onCancelar: () => void;
  onCriado: (contato: ContatoClienteDto) => void;
}) {
  const [nome, setNome] = useState("");
  const [telefoneDdd, setTelefoneDdd] = useState("");
  const [telefoneNumero, setTelefoneNumero] = useState("");
  const [email, setEmail] = useState("");
  const [funcao, setFuncao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onConfirmar() {
    if (!clienteId || !nome.trim()) {
      setErro("Informe o nome do contato.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const resultado = await criarContatoCliente(clienteId, {
      nome: nome.trim(),
      telefoneDdd: telefoneDdd.trim() || undefined,
      telefoneNumero: telefoneNumero.trim() || undefined,
      email: email.trim() || undefined,
      funcao: funcao.trim() || undefined,
    });
    setEnviando(false);
    if (resultado.status === "sucesso") {
      setNome("");
      setTelefoneDdd("");
      setTelefoneNumero("");
      setEmail("");
      setFuncao("");
      onCriado(resultado.contato);
    } else {
      setErro(resultado.mensagem);
    }
  }

  return (
    <Modal open={open} onClose={onCancelar} title="Adicionar contato">
      <div className="flex flex-col gap-3">
        <Campo label="Nome" value={nome} onChange={setNome} autoFocus />
        <div className="flex gap-3">
          <Campo label="DDD" value={telefoneDdd} onChange={setTelefoneDdd} className="w-20" />
          <Campo label="Telefone" value={telefoneNumero} onChange={setTelefoneNumero} className="flex-1" />
        </div>
        <Campo label="E-mail" value={email} onChange={setEmail} />
        <Campo label="Função" value={funcao} onChange={setFuncao} />
        {erro && <p className="text-xs font-medium text-ink">{erro}</p>}
      </div>
      <div className="mt-6">
        <ModalFooter
          onCancelar={onCancelar}
          onConfirmar={onConfirmar}
          rotuloConfirmar={enviando ? "Salvando..." : "Adicionar"}
          confirmarDesabilitado={enviando}
        />
      </div>
    </Modal>
  );
}

function Campo({
  label,
  value,
  onChange,
  className = "",
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-muted ${className}`}>
      {label}
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(evento) => onChange(evento.target.value)}
        className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
      />
    </label>
  );
}
