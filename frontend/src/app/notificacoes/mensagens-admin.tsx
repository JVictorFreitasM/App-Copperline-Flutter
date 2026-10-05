"use client";

import { useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import type {
  DestinatarioMensagemDto,
  GrupoMensagemDto,
  MensagemPeriodicaDto,
} from "@/lib/mensagens";
import { GruposModal } from "./grupos-modal";
import { NovaMensagemModal } from "./nova-mensagem-modal";
import { PeriodicasModal } from "./periodicas-modal";

// Qual janela está aberta. A de "Nova mensagem" lembra de onde veio: aberta
// a partir da lista de periódicas (cadastrar/editar), fechar volta pra
// lista em vez de sair da tela.
type Janela =
  | { tipo: "nenhuma" }
  | { tipo: "nova" }
  | { tipo: "grupos" }
  | { tipo: "periodicas" }
  | { tipo: "periodica-form"; edicao: MensagemPeriodicaDto | null };

// Botões do cabeçalho de /notificacoes (só renderizado pra admin, ver
// page.tsx - o backend também recusa quem não é admin, isso aqui é só
// conveniência de tela).
export function MensagensAdmin({
  vendedores,
  grupos,
  periodicas,
}: {
  vendedores: DestinatarioMensagemDto[];
  grupos: GrupoMensagemDto[];
  periodicas: MensagemPeriodicaDto[];
}) {
  const [janela, setJanela] = useState<Janela>({ tipo: "nenhuma" });
  const fechar = () => setJanela({ tipo: "nenhuma" });
  const voltarParaPeriodicas = () => setJanela({ tipo: "periodicas" });

  return (
    <>
      <SecondaryButton type="button" onClick={() => setJanela({ tipo: "periodicas" })}>
        Periódicas
      </SecondaryButton>
      <SecondaryButton type="button" onClick={() => setJanela({ tipo: "grupos" })}>
        Grupos
      </SecondaryButton>
      <PrimaryButton type="button" onClick={() => setJanela({ tipo: "nova" })}>
        Nova mensagem
      </PrimaryButton>

      {janela.tipo === "nova" && (
        <NovaMensagemModal
          onClose={fechar}
          onPeriodicaSalva={voltarParaPeriodicas}
          vendedores={vendedores}
          grupos={grupos}
        />
      )}
      {janela.tipo === "periodica-form" && (
        <NovaMensagemModal
          onClose={voltarParaPeriodicas}
          onPeriodicaSalva={voltarParaPeriodicas}
          vendedores={vendedores}
          grupos={grupos}
          modoInicial="PERIODICA"
          edicao={janela.edicao}
        />
      )}
      {janela.tipo === "periodicas" && (
        <PeriodicasModal
          periodicas={periodicas}
          onClose={fechar}
          onNova={() => setJanela({ tipo: "periodica-form", edicao: null })}
          onEditar={(periodica) => setJanela({ tipo: "periodica-form", edicao: periodica })}
        />
      )}
      <GruposModal
        open={janela.tipo === "grupos"}
        onClose={fechar}
        vendedores={vendedores}
        grupos={grupos}
      />
    </>
  );
}
