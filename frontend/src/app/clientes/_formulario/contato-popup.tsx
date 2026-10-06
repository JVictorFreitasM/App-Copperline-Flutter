"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/design/modal";
import { contatoVazio, type ContatoFormulario, type TelefoneInput } from "@/lib/cadastro-cliente";
import { Campo, MensagemErro } from "./campos";
import { CampoTelefones } from "./campo-telefones";

// Popup "Adicionar contato ao cliente" da tela de referência. O contato do
// cadastro no WK Radar tem UM telefone (telefoneDDD/telefoneNumero), por isso
// o campo de telefone aqui aceita só 1.
export function ContatoPopup({
  open,
  onCancelar,
  onCriar,
}: {
  open: boolean;
  onCancelar: () => void;
  onCriar: (contato: ContatoFormulario) => void;
}) {
  const [contato, setContato] = useState<ContatoFormulario>(contatoVazio());
  const [telefones, setTelefones] = useState<TelefoneInput[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  function atualizar(campos: Partial<ContatoFormulario>) {
    setContato((atual) => ({ ...atual, ...campos }));
  }

  function fechar() {
    setContato(contatoVazio());
    setTelefones([]);
    setErro(null);
    onCancelar();
  }

  function criar() {
    if (contato.nome.trim() === "") {
      setErro("Informe o nome do contato.");
      return;
    }
    if (contato.email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(contato.email.trim())) {
      setErro("E-mail inválido.");
      return;
    }
    onCriar({
      ...contato,
      telefoneDdd: telefones[0]?.ddd ?? "",
      telefoneNumero: telefones[0]?.numero ?? "",
    });
    setContato(contatoVazio());
    setTelefones([]);
    setErro(null);
  }

  return (
    <Modal open={open} onClose={fechar} title="Adicionar contato ao cliente">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo
          label="Nome"
          value={contato.nome}
          onChange={(nome) => atualizar({ nome })}
          placeholder="Nome do contato"
          maxLength={50}
          autoFocus
        />
        <Campo
          label="Cargo"
          value={contato.funcao}
          onChange={(funcao) => atualizar({ funcao })}
          placeholder="Cargo ou função"
          maxLength={30}
        />
        <div className="flex flex-col gap-1 text-xs text-muted">
          Telefone
          <CampoTelefones telefones={telefones} onChange={setTelefones} max={1} />
        </div>
        <Campo
          label="E-mail"
          value={contato.email}
          onChange={(email) => atualizar({ email })}
          type="email"
          placeholder="Email do contato"
          maxLength={64}
        />
        <Campo
          label="Data de aniversário"
          value={contato.dataNascimento}
          onChange={(dataNascimento) => atualizar({ dataNascimento })}
          type="date"
        />
      </div>
      {erro && (
        <div className="mt-3">
          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}
      <div className="mt-6">
        <ModalFooter
          onCancelar={fechar}
          onConfirmar={criar}
          rotuloConfirmar="Criar"
          confirmarDesabilitado={contato.nome.trim() === ""}
        />
      </div>
    </Modal>
  );
}
