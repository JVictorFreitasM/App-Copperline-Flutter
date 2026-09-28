"use client";

import { useState } from "react";
import { IconeAlerta } from "@/components/design/icons";
import { Modal } from "@/components/design/modal";

// "Ver PDF" virou botao (nao mais <a target="_blank"> direto pra rota BFF)
// porque quando o PDF nao existe na pasta compartilhada (backend responde
// 404) o navegador abria uma aba nova so com o JSON cru do erro - nada
// amigavel. Aqui buscamos primeiro, e so abrimos aba nova se realmente
// vier um PDF; erro vira modal com o vocabulario do usuario.
export function LinkPdfNotaFiscal({ notaId, numero }: { notaId: string; numero: number | null }) {
  const [carregando, setCarregando] = useState(false);
  const [erroAberto, setErroAberto] = useState(false);
  const [motivoIndisponivel, setMotivoIndisponivel] = useState<
    "nao_gerado" | "falha_geral"
  >("nao_gerado");

  async function abrirPdf() {
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/notas-fiscais/${notaId}/pdf`, {
        cache: "no-store",
      });

      if (!resposta.ok) {
        setMotivoIndisponivel(resposta.status === 404 ? "nao_gerado" : "falha_geral");
        setErroAberto(true);
        return;
      }

      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Revoga depois de um tempo - da' margem pra aba nova terminar de
      // carregar o blob antes da URL deixar de ser valida.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setMotivoIndisponivel("falha_geral");
      setErroAberto(true);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirPdf}
        disabled={carregando}
        className="text-sm font-medium text-primary hover:underline disabled:cursor-wait disabled:opacity-60"
      >
        {carregando ? "Abrindo…" : "Ver nota fiscal"}
      </button>

      <Modal
        open={erroAberto}
        onClose={() => setErroAberto(false)}
        title="PDF não disponível"
        largura="max-w-md"
      >
        <div className="flex gap-3">
          <span className="mt-0.5 shrink-0 text-ink">
            <IconeAlerta />
          </span>
          <div className="flex flex-col gap-2 text-sm text-ink">
            {motivoIndisponivel === "nao_gerado" ? (
              <>
                <p>
                  O PDF da NF-e {numero ? `${numero} ` : ""}ainda não está disponível na pasta
                  compartilhada.
                </p>
                <p className="text-muted">
                  Isso costuma acontecer quando o arquivo ainda não foi gerado/copiado pra pasta
                  de rede pelo sistema fiscal, ou a nota é muito recente. Tente de novo em alguns
                  minutos.
                </p>
              </>
            ) : (
              <p>
                Não foi possível carregar o PDF agora. Tente novamente em instantes; se o
                problema continuar, avise o time de TI.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
