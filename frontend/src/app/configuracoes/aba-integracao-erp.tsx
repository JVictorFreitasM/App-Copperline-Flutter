"use client";

import { useState, useTransition } from "react";
import type { CredencialErpDto } from "@/lib/configuracoes";
import { atualizarCredenciaisErp, testarConexaoRadar } from "./actions";
import { LinhaConfiguracao, RodapeSalvar } from "./campos";

const GRUPOS: { id: CredencialErpDto["grupo"]; titulo: string; descricao: string }[] = [
  {
    id: "RADAR",
    titulo: "WK Radar (API)",
    descricao: "Pedidos, clientes, produtos e notas fiscais (sincronização e envio).",
  },
  {
    id: "BI",
    titulo: "WK Radar (relatórios e serviços .svc)",
    descricao: "Estoque, tabelas de preço e posição financeira.",
  },
];

// Aba "Integração ERP": cadastra as credenciais do WK Radar/WK BI pelo painel,
// sem mexer em env nem reiniciar. Valor salvo aqui vale no lugar da env; campo
// vazio volta a usar a env. Senhas ficam cifradas e nunca são exibidas.
export function AbaIntegracaoErp({ inicial }: { inicial: CredencialErpDto[] }) {
  const [credenciais, setCredenciais] = useState(inicial);
  // Só o que o admin digitou: chave -> texto ("" = voltar para a env).
  const [editados, setEditados] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);

  const alterado = Object.keys(editados).length > 0;

  function valorExibido(credencial: CredencialErpDto): string {
    return credencial.chave in editados ? editados[credencial.chave] : (credencial.valor ?? "");
  }

  function salvar() {
    setErro(null);
    setSucesso(false);
    setTeste(null);
    startTransition(async () => {
      try {
        const atualizadas = await atualizarCredenciaisErp(editados);
        setCredenciais(atualizadas);
        setEditados({});
        setSucesso(true);
      } catch {
        setErro("Falha ao salvar.");
      }
    });
  }

  function testar() {
    setTeste(null);
    startTransition(async () => {
      try {
        setTeste(await testarConexaoRadar());
      } catch {
        setTeste({ ok: false, mensagem: "Não foi possível executar o teste." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {GRUPOS.map((grupo) => (
        <section key={grupo.id} className="flex flex-col">
          <div className="mb-2">
            <h2 className="text-base font-semibold text-ink">{grupo.titulo}</h2>
            <p className="text-xs text-muted">{grupo.descricao}</p>
          </div>
          <div className="flex flex-col divide-y divide-black/5">
            {credenciais
              .filter((credencial) => credencial.grupo === grupo.id)
              .map((credencial) => (
                <LinhaConfiguracao
                  key={credencial.chave}
                  titulo={credencial.rotulo}
                  descricao={descricaoOrigem(credencial, credencial.chave in editados)}
                >
                  <input
                    type={credencial.secreta ? "password" : "text"}
                    autoComplete="off"
                    value={valorExibido(credencial)}
                    disabled={pending}
                    placeholder={credencial.secreta && credencial.definida ? "•••••••• (definida)" : ""}
                    onChange={(evento) =>
                      setEditados((atual) => ({ ...atual, [credencial.chave]: evento.target.value }))
                    }
                    className="w-80 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </LinhaConfiguracao>
              ))}
          </div>
          {grupo.id === "RADAR" && (
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                disabled={pending || alterado}
                onClick={testar}
                title={alterado ? "Salve as alterações antes de testar" : undefined}
                className="rounded-full bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Testar conexão com o WK Radar
              </button>
              {teste && <span className="text-xs text-ink">{teste.mensagem}</span>}
            </div>
          )}
        </section>
      ))}

      <RodapeSalvar visivel={alterado} pending={pending} erro={erro} sucesso={sucesso} onSalvar={salvar} />
    </div>
  );
}

function descricaoOrigem(credencial: CredencialErpDto, editando: boolean): string {
  if (editando) return "Alteração ainda não salva. Deixe vazio para voltar a usar o valor do ambiente.";
  if (credencial.origem === "painel") return "Definido pelo painel. Apague e salve para voltar ao valor do ambiente.";
  if (credencial.origem === "ambiente") return "Vindo da configuração do servidor (ambiente). Preencha para sobrescrever.";
  return credencial.obrigatoria ? "Não configurado — necessário para a integração." : "Não configurado (opcional).";
}
