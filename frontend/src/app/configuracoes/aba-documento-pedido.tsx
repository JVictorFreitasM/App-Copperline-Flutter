"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { ComunicadoPedidoPdfDto, DadosEmpresaPdfDto } from "@/lib/configuracoes";
import { atualizarComunicadoPedidoPdf, atualizarDadosEmpresaPdf } from "./actions";
import { CampoTexto, CampoTextoLongo, RodapeSalvar } from "./campos";

// Aba "Documento do Pedido" (pedido do usuario, 2026-09-28) - cabecalho
// fixo (razao social/CNPJ/endereco/telefone) e comunicado (2a pagina,
// "Premissas e Outras Observações" no modelo de referencia) do PDF de
// impressao do pedido (botao "Exportar PDF" na tela de detalhe). Os dois
// blocos sao servicos/tabelas independentes no backend, mas vivem juntos
// aqui por serem sempre editados na mesma tela - cada um com seu proprio
// estado/salvar, sem depender um do outro.
export function AbaDocumentoPedido({
  empresaInicial,
  comunicadoInicial,
}: {
  empresaInicial: DadosEmpresaPdfDto;
  comunicadoInicial: ComunicadoPedidoPdfDto;
}) {
  return (
    <div className="flex flex-col divide-y divide-black/5">
      <SecaoEmpresa inicial={empresaInicial} />
      <SecaoComunicado inicial={comunicadoInicial} />
    </div>
  );
}

function SecaoEmpresa({ inicial }: { inicial: DadosEmpresaPdfDto }) {
  const [valores, setValores] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const alterado =
    valores.razaoSocial !== inicial.razaoSocial ||
    valores.cnpj !== inicial.cnpj ||
    valores.endereco !== inicial.endereco ||
    valores.cep !== inicial.cep ||
    valores.telefone !== inicial.telefone;

  function salvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      try {
        const atualizado = await atualizarDadosEmpresaPdf({
          razaoSocial: valores.razaoSocial,
          cnpj: valores.cnpj,
          endereco: valores.endereco,
          cep: valores.cep,
          telefone: valores.telefone,
        });
        setValores(atualizado);
        setSucesso(true);
      } catch {
        setErro("Falha ao salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 py-5 first:pt-0">
      <div>
        <p className="text-sm font-semibold text-ink">Dados da empresa</p>
        <p className="mt-1 text-xs text-muted">
          Cabeçalho fixo do PDF de impressão do pedido (razão social, CNPJ, endereço e telefone).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoRotulado titulo="Razão social">
          <CampoTexto
            valor={valores.razaoSocial}
            disabled={pending}
            onChange={(valor) => setValores((atual) => ({ ...atual, razaoSocial: valor }))}
          />
        </CampoRotulado>
        <CampoRotulado titulo="CNPJ">
          <CampoTexto
            valor={valores.cnpj}
            disabled={pending}
            onChange={(valor) => setValores((atual) => ({ ...atual, cnpj: valor }))}
          />
        </CampoRotulado>
        <CampoRotulado titulo="Endereço">
          <CampoTexto
            valor={valores.endereco}
            disabled={pending}
            onChange={(valor) => setValores((atual) => ({ ...atual, endereco: valor }))}
          />
        </CampoRotulado>
        <CampoRotulado titulo="CEP">
          <CampoTexto
            valor={valores.cep}
            disabled={pending}
            onChange={(valor) => setValores((atual) => ({ ...atual, cep: valor }))}
          />
        </CampoRotulado>
        <CampoRotulado titulo="Telefone">
          <CampoTexto
            valor={valores.telefone}
            disabled={pending}
            onChange={(valor) => setValores((atual) => ({ ...atual, telefone: valor }))}
          />
        </CampoRotulado>
      </div>

      <RodapeSalvar visivel={alterado} pending={pending} erro={erro} sucesso={sucesso} onSalvar={salvar} />
    </div>
  );
}

function SecaoComunicado({ inicial }: { inicial: ComunicadoPedidoPdfDto }) {
  const [texto, setTexto] = useState(inicial.texto);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const alterado = texto !== inicial.texto;

  function salvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      try {
        const atualizado = await atualizarComunicadoPedidoPdf(texto);
        setTexto(atualizado.texto);
        setSucesso(true);
      } catch {
        setErro("Falha ao salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 py-5 last:pb-0">
      <div>
        <p className="text-sm font-semibold text-ink">Comunicado (2ª página do PDF)</p>
        <p className="mt-1 text-xs text-muted">
          Texto de &quot;Premissas e Outras Observações&quot; impresso na 2ª página de todo PDF de
          pedido gerado a partir de agora - vale pra qualquer pedido, até ser alterado de novo.
        </p>
      </div>

      <CampoTextoLongo
        valor={texto}
        disabled={pending}
        linhas={10}
        placeholder="1. Proposta válida por 24 horas; 2. ..."
        onChange={setTexto}
      />

      <RodapeSalvar visivel={alterado} pending={pending} erro={erro} sucesso={sucesso} onSalvar={salvar} />
    </div>
  );
}

function CampoRotulado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{titulo}</span>
      {children}
    </label>
  );
}
