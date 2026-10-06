"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/design/modal";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import {
  consultaDeLocalizacao,
  enderecoEstaCompleto,
  enderecoVazio,
  formatarCep,
  type EnderecoFormulario,
} from "@/lib/cadastro-cliente";
import { buscarCepAction, localizarEnderecoAction } from "./acoes-endereco";
import { Campo, MensagemErro } from "./campos";
import { MapaEnderecoWrapper } from "./mapa-endereco-wrapper";

// Popup "Cadastrar endereço" (cobrança/entrega) da tela de referência: CEP
// preenche logradouro/bairro/cidade/UF sozinho (consulta cacheada no backend)
// e o mapa (OpenStreetMap) marca o ponto - "Localizar" acha o endereço no mapa
// e o pino pode ser ajustado por clique ou arrasto.
export function EnderecoPopup({
  open,
  onCancelar,
  onSalvar,
}: {
  open: boolean;
  onCancelar: () => void;
  onSalvar: (endereco: EnderecoFormulario) => void;
}) {
  const [endereco, setEndereco] = useState<EnderecoFormulario>(enderecoVazio());
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Ignora resposta de CEP que chegou depois de o usuário já ter mudado o CEP.
  const cepEmBusca = useRef<string | null>(null);

  function atualizar(campos: Partial<EnderecoFormulario>) {
    setEndereco((atual) => ({ ...atual, ...campos }));
  }

  async function aoMudarCep(valor: string) {
    const mascarado = formatarCep(valor);
    atualizar({ cep: mascarado });
    const digitos = mascarado.replace(/\D/g, "");
    if (digitos.length < 8) {
      cepEmBusca.current = null;
      return;
    }
    cepEmBusca.current = digitos;
    setBuscandoCep(true);
    setErro(null);
    const resultado = await buscarCepAction(digitos);
    if (cepEmBusca.current !== digitos) return;
    setBuscandoCep(false);

    if (resultado.status === "ok") {
      const { cep } = resultado;
      setEndereco((atual) => ({
        ...atual,
        logradouro: cep.logradouro ?? atual.logradouro,
        bairro: cep.bairro ?? atual.bairro,
        complemento: atual.complemento || cep.complemento || "",
        cidade: cep.localidade ?? atual.cidade,
        uf: cep.uf ?? atual.uf,
        codigoIbge: cep.codigoIbge,
      }));
    } else if (resultado.status === "nao-encontrado") {
      atualizar({ codigoIbge: null });
      setErro("CEP não encontrado - preencha o endereço manualmente.");
    } else {
      setErro(resultado.mensagem);
    }
  }

  async function localizar() {
    const consultas = consultaDeLocalizacao(endereco);
    if (consultas.length === 0) {
      setErro("Preencha o CEP ou o logradouro para localizar no mapa.");
      return;
    }
    setLocalizando(true);
    setErro(null);
    const resultado = await localizarEnderecoAction(consultas);
    setLocalizando(false);
    if (resultado.status === "ok") {
      atualizar({ latitude: resultado.local.latitude, longitude: resultado.local.longitude });
    } else if (resultado.status === "nao-encontrado") {
      setErro("Não foi possível achar o endereço no mapa - clique no mapa para marcar o ponto.");
    } else {
      setErro(resultado.mensagem);
    }
  }

  function limpar() {
    cepEmBusca.current = null;
    setEndereco(enderecoVazio());
    setErro(null);
  }

  function salvar() {
    if (!enderecoEstaCompleto(endereco)) {
      setErro("Informe CEP (8 dígitos), logradouro, número (ou marque sem número) e bairro.");
      return;
    }
    if (endereco.cidade.trim() === "" || !/^[A-Za-z]{2}$/.test(endereco.uf)) {
      setErro("Informe a cidade e o estado (UF com 2 letras).");
      return;
    }
    onSalvar({ ...endereco, uf: endereco.uf.toUpperCase() });
    limpar();
  }

  return (
    <Modal open={open} onClose={onCancelar} title="Cadastrar endereço" largura="max-w-5xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Campo
            label={buscandoCep ? "CEP (consultando...)" : "CEP"}
            value={endereco.cep}
            onChange={aoMudarCep}
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            autoFocus
          />
          <div className="flex gap-3">
            <Campo
              label="Logradouro"
              value={endereco.logradouro}
              onChange={(logradouro) => atualizar({ logradouro })}
              className="flex-1"
              maxLength={84}
            />
            <Campo
              label="Número"
              value={endereco.semNumero ? "" : endereco.numero}
              onChange={(numero) => atualizar({ numero: numero.replace(/\D/g, "") })}
              disabled={endereco.semNumero}
              inputMode="numeric"
              className="w-28"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={endereco.semNumero}
              onChange={(evento) => atualizar({ semNumero: evento.target.checked, numero: "" })}
            />
            Sem número
          </label>
          <div className="flex gap-3">
            <Campo
              label="Complemento"
              value={endereco.complemento}
              onChange={(complemento) => atualizar({ complemento })}
              className="flex-1"
              maxLength={60}
            />
            <Campo
              label="Bairro"
              value={endereco.bairro}
              onChange={(bairro) => atualizar({ bairro })}
              className="flex-1"
              maxLength={60}
            />
          </div>
          <div className="flex gap-3">
            <Campo
              label="Cidade"
              value={endereco.cidade}
              onChange={(cidade) => atualizar({ cidade })}
              className="flex-1"
            />
            <Campo
              label="Estado"
              value={endereco.uf}
              onChange={(uf) => atualizar({ uf: uf.replace(/[^A-Za-z]/g, "").toUpperCase() })}
              maxLength={2}
              className="w-20"
            />
            <Campo label="País" value="Brasil" onChange={() => undefined} disabled className="w-28" />
          </div>
          {erro && <MensagemErro>{erro}</MensagemErro>}
          <div className="flex flex-wrap gap-3 pt-2">
            <SecondaryButton onClick={localizar} disabled={localizando}>
              {localizando ? "Localizando..." : "Localizar..."}
            </SecondaryButton>
            <PrimaryButton onClick={salvar}>Salvar</PrimaryButton>
            <SecondaryButton onClick={onCancelar}>Cancelar</SecondaryButton>
            <SecondaryButton onClick={limpar}>Limpar</SecondaryButton>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="h-72 overflow-hidden rounded-card md:h-full md:min-h-80">
            <MapaEnderecoWrapper
              latitude={endereco.latitude}
              longitude={endereco.longitude}
              onEscolher={(latitude, longitude) => atualizar({ latitude, longitude })}
            />
          </div>
          <p className="text-xs text-muted">
            Clique no mapa ou arraste o pino para ajustar o ponto - ele vira a localização do cliente.
          </p>
        </div>
      </div>
    </Modal>
  );
}
