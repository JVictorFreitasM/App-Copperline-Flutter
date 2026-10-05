"use client";

import { useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import type { DestinatarioMensagemDto, GrupoMensagemDto } from "@/lib/mensagens";
import { GruposModal } from "./grupos-modal";
import { NovaMensagemModal } from "./nova-mensagem-modal";

// Botões "Nova mensagem" e "Grupos" do cabeçalho de /notificacoes (só
// renderizado pra admin, ver page.tsx - o backend também recusa quem não é
// admin, isso aqui é só conveniência de tela).
export function MensagensAdmin({
  vendedores,
  grupos,
}: {
  vendedores: DestinatarioMensagemDto[];
  grupos: GrupoMensagemDto[];
}) {
  const [novaMensagemAberta, setNovaMensagemAberta] = useState(false);
  const [gruposAberto, setGruposAberto] = useState(false);

  return (
    <>
      <SecondaryButton type="button" onClick={() => setGruposAberto(true)}>
        Grupos
      </SecondaryButton>
      <PrimaryButton type="button" onClick={() => setNovaMensagemAberta(true)}>
        Nova mensagem
      </PrimaryButton>

      <NovaMensagemModal
        open={novaMensagemAberta}
        onClose={() => setNovaMensagemAberta(false)}
        vendedores={vendedores}
        grupos={grupos}
      />
      <GruposModal
        open={gruposAberto}
        onClose={() => setGruposAberto(false)}
        vendedores={vendedores}
        grupos={grupos}
      />
    </>
  );
}
