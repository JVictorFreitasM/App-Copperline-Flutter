"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import {
  enderecoEdicaoParaFormulario,
  enderecoParaPayload,
  formatarDocumento,
  formatarValorParaCampo,
  parseValorMonetario,
  type AtualizarClientePayload,
  type ClienteEdicaoDto,
  type EnderecoFormulario,
  type TelefoneInput,
} from "@/lib/cadastro-cliente";
import { Campo, MensagemErro } from "../../_formulario/campos";
import { CampoTelefones } from "../../_formulario/campo-telefones";
import { EnderecoPopup } from "../../_formulario/endereco-popup";
import { NOVO_ENDERECO, SeletorEndereco } from "../../_formulario/seletor-endereco";
import { atualizarClienteAction } from "./actions";

interface EstadoEnderecos {
  lista: EnderecoFormulario[];
  cobranca: number | null;
  entrega: number | null;
}

// Endereços que o cliente já tem viram as primeiras opções dos seletores. A
// entrega só aparece separada quando é diferente da cobrança.
function enderecosIniciais(cliente: ClienteEdicaoDto): EstadoEnderecos {
  const lista: EnderecoFormulario[] = [];
  let cobranca: number | null = null;
  let entrega: number | null = null;
  if (cliente.enderecoCobranca) {
    lista.push(enderecoEdicaoParaFormulario(cliente.enderecoCobranca));
    cobranca = 0;
  }
  if (cliente.enderecoEntrega && !cliente.entregaIgualCobranca) {
    lista.push(enderecoEdicaoParaFormulario(cliente.enderecoEntrega));
    entrega = lista.length - 1;
  }
  return { lista, cobranca, entrega };
}

// Edição de cliente (web). CPF/CNPJ, tipo de pessoa e código não são
// editáveis (o PATCH do WK Radar não aceita). Contatos ficam fora daqui. O
// backend compara com o que já tem e só leva ao ERP o que mudou - endereço só
// vai quando o usuário escolhe outro.
export function FormularioEditarCliente({ cliente }: { cliente: ClienteEdicaoDto }) {
  const router = useRouter();
  const fisica = cliente.tipoPessoa === "Fisica";

  const [razaoSocial, setRazaoSocial] = useState(cliente.razaoSocial ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(cliente.nomeFantasia ?? "");
  const [inscricaoEstadual, setInscricaoEstadual] = useState(cliente.inscricaoEstadual ?? "");
  const [rg, setRg] = useState(cliente.rg ?? "");
  const [dataNascimento, setDataNascimento] = useState(cliente.dataNascimento ?? "");
  const [nomeMae, setNomeMae] = useState(cliente.nomeMae ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [limiteCredito, setLimiteCredito] = useState(formatarValorParaCampo(cliente.limiteCredito));
  const [telefones, setTelefones] = useState<TelefoneInput[]>(cliente.telefones);

  const [inicial] = useState(() => enderecosIniciais(cliente));
  const [enderecos, setEnderecos] = useState<EstadoEnderecos>(inicial);
  const [entregaIgual, setEntregaIgual] = useState(cliente.entregaIgualCobranca);
  const [popupEndereco, setPopupEndereco] = useState<"cobranca" | "entrega" | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function aoEscolherEndereco(destino: "cobranca" | "entrega", valor: string) {
    if (valor === NOVO_ENDERECO) {
      setPopupEndereco(destino);
      return;
    }
    const indice = valor === "" ? null : Number(valor);
    setEnderecos((atual) => ({ ...atual, [destino]: indice }));
  }

  function aoSalvarEndereco(endereco: EnderecoFormulario) {
    const destino = popupEndereco;
    setEnderecos((atual) => ({
      lista: [...atual.lista, endereco],
      cobranca: destino === "cobranca" ? atual.lista.length : atual.cobranca,
      entrega: destino === "entrega" ? atual.lista.length : atual.entrega,
    }));
    setPopupEndereco(null);
  }

  function validar(): string | null {
    if (razaoSocial.trim() === "") {
      return fisica ? "Informe o nome do cliente." : "Informe a razão social.";
    }
    if (email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return "E-mail inválido.";
    }
    if (limiteCredito.trim() !== "" && parseValorMonetario(limiteCredito) === undefined) {
      return "Limite de crédito inválido.";
    }
    if (inicial.cobranca !== null && enderecos.cobranca === null) {
      return "Defina o endereço de cobrança.";
    }
    return null;
  }

  async function salvar() {
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    const limite = parseValorMonetario(limiteCredito);
    const cobrancaMudou = enderecos.cobranca !== null && enderecos.cobranca !== inicial.cobranca;
    const entregaMudou = !entregaIgual && enderecos.entrega !== null && enderecos.entrega !== inicial.entrega;

    const payload: AtualizarClientePayload = {
      razaoSocial: razaoSocial.trim(),
      ...(fisica ? {} : { nomeFantasia: nomeFantasia.trim() }),
      inscricaoEstadual: inscricaoEstadual.trim(),
      email: email.trim(),
      ...(limite !== undefined ? { limiteCredito: limite } : {}),
      ...(fisica ? { rg: rg.trim(), dataNascimento, nomeMae: nomeMae.trim() } : {}),
      telefones,
      entregaIgualCobranca: entregaIgual,
      ...(cobrancaMudou ? { enderecoCobranca: enderecoParaPayload(enderecos.lista[enderecos.cobranca!]) } : {}),
      ...(entregaMudou ? { enderecoEntrega: enderecoParaPayload(enderecos.lista[enderecos.entrega!]) } : {}),
    };

    setSalvando(true);
    setErro(null);
    setAviso(null);
    const resultado = await atualizarClienteAction(cliente.id, payload);
    if (resultado.status === "erro") {
      setSalvando(false);
      setErro(resultado.mensagem);
      return;
    }
    if (resultado.resultado.situacao === "SEM_ALTERACAO") {
      setSalvando(false);
      setAviso("Nada mudou - nenhuma alteração foi enviada.");
      return;
    }
    router.push(`/clientes/${cliente.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <PrimaryButton onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </PrimaryButton>
      </div>

      {(erro || aviso) && (
        <Card>
          <MensagemErro>{erro ?? aviso}</MensagemErro>
        </Card>
      )}

      <Card className="flex flex-col gap-6">
        {/* Identificação: não editável (o PATCH do Radar não aceita) */}
        <div className="flex flex-wrap items-end gap-4">
          <Campo
            label={fisica ? "CPF" : "CNPJ"}
            value={cliente.cpfCnpj ? formatarDocumento(cliente.cpfCnpj) : "—"}
            onChange={() => undefined}
            disabled
            className="w-64"
          />
          <Campo label="Código do cliente (Radar)" value={cliente.codigo ?? "—"} onChange={() => undefined} disabled className="w-56" />
          <p className="pb-2 text-xs text-muted">Documento, tipo de pessoa e código não podem ser alterados.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fisica ? (
            <>
              <Campo label="Nome" value={razaoSocial} onChange={setRazaoSocial} placeholder="Nome do cliente" maxLength={80} />
              <Campo label="RG" value={rg} onChange={setRg} placeholder="Digite o RG" maxLength={15} />
              <Campo label="Data de nascimento" value={dataNascimento} onChange={setDataNascimento} type="date" />
              <Campo label="Filiação" value={nomeMae} onChange={setNomeMae} placeholder="Nome da mãe" maxLength={50} />
            </>
          ) : (
            <>
              <Campo
                label="Nome Fantasia"
                value={nomeFantasia}
                onChange={setNomeFantasia}
                placeholder="Nome fantasia da empresa"
                maxLength={50}
              />
              <Campo
                label="Razão Social"
                value={razaoSocial}
                onChange={setRazaoSocial}
                placeholder="Razão social da empresa"
                maxLength={80}
              />
            </>
          )}
          <Campo
            label="Inscrição Estadual"
            value={inscricaoEstadual}
            onChange={setInscricaoEstadual}
            placeholder="Digite a Inscrição Estadual"
            maxLength={17}
          />
        </div>
        {fisica && !cliente.camposPessoaFisicaConhecidos && (
          <p className="text-xs text-muted">
            RG, nascimento e filiação deste cliente estão no Radar e não aparecem aqui: em branco, ficam como estão;
            preenchidos, substituem o que estiver lá.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {/* Antes dos seletores: marcado, um único endereço serve de cobrança e entrega. */}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={entregaIgual} onChange={(evento) => setEntregaIgual(evento.target.checked)} />
            Usar o mesmo endereço
            <span className="text-xs text-muted">(cobrança e entrega)</span>
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SeletorEndereco
              rotulo={entregaIgual ? "Endereço de Cobrança e Entrega" : "Endereço de Cobrança"}
              enderecos={enderecos.lista}
              selecionado={enderecos.cobranca}
              onEscolher={(valor) => aoEscolherEndereco("cobranca", valor)}
            />
            {!entregaIgual && (
              <SeletorEndereco
                rotulo="Endereço de Entrega"
                enderecos={enderecos.lista}
                selecionado={enderecos.entrega}
                onEscolher={(valor) => aoEscolherEndereco("entrega", valor)}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1 text-xs text-muted">
            Telefones
            <CampoTelefones telefones={telefones} onChange={setTelefones} />
          </div>
          <Campo label="E-mail" value={email} onChange={setEmail} type="email" placeholder="Digite o email" />
          <Campo
            label="Limite de Crédito"
            value={limiteCredito}
            onChange={setLimiteCredito}
            inputMode="decimal"
            placeholder="Digite o valor limite"
          />
        </div>
      </Card>

      <EnderecoPopup open={popupEndereco !== null} onCancelar={() => setPopupEndereco(null)} onSalvar={aoSalvarEndereco} />
    </div>
  );
}
