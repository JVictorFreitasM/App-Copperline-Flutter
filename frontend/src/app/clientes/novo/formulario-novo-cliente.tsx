"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/design/card";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { Switch } from "@/components/design/switch";
import {
  aplicarMascaraDocumento,
  contatoParaPayload,
  enderecoParaPayload,
  extrairTelefones,
  formatarDocumento,
  formatarTelefone,
  normalizarDocumento,
  parseValorMonetario,
  tipoPessoaDoDocumento,
  type ContatoFormulario,
  type CriarClientePayload,
  type EnderecoFormulario,
  type TelefoneInput,
  type TipoPessoa,
} from "@/lib/cadastro-cliente";
import type { ClienteJaCadastradoDto, ConsultaCnpjResultadoDto } from "@/lib/consulta-cnpj";
import { Campo, MensagemErro } from "../_formulario/campos";
import { CampoTelefones } from "../_formulario/campo-telefones";
import { ContatoPopup } from "../_formulario/contato-popup";
import { EnderecoPopup } from "../_formulario/endereco-popup";
import { NOVO_ENDERECO, SeletorEndereco } from "../_formulario/seletor-endereco";
import { consultarDocumentoAction, criarClienteAction } from "./actions";

type EstadoDocumento =
  | { status: "idle" }
  | { status: "consultando" }
  | { status: "ok"; mensagem: string }
  | { status: "ja-cadastrado"; cliente: ClienteJaCadastradoDto }
  | { status: "aviso"; mensagem: string }
  | { status: "erro"; mensagem: string };

// Endereços cadastrados NESTE formulário + qual está escolhido pra cobrança e
// pra entrega (null = "A definir"). Num estado só porque o autopreenchimento
// da Receita cadastra o endereço e já escolhe os dois de uma vez.
interface EstadoEnderecos {
  lista: EnderecoFormulario[];
  cobranca: number | null;
  entrega: number | null;
}

// Cadastro de cliente (web). Ao completar o CPF/CNPJ: valida por cálculo, o
// backend confere a base da empresa, depois o cache e só então a Receita - e o
// que voltar preenche o formulário (só campos ainda vazios, nunca sobrescreve
// o que o usuário digitou). A gravação é no Postgres e o envio ao WK Radar é
// por fila (status PENDENTE até o ERP aceitar).
export function FormularioNovoCliente() {
  const router = useRouter();

  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("Juridica");
  const [documento, setDocumento] = useState("");
  const [estadoDocumento, setEstadoDocumento] = useState<EstadoDocumento>({ status: "idle" });
  // Documento já consultado (evita reconsultar o mesmo) - em estado, não ref:
  // é lido no render pra decidir o texto de feedback.
  const [documentoConsultado, setDocumentoConsultado] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [nomeMae, setNomeMae] = useState("");

  const [enderecos, setEnderecos] = useState<EstadoEnderecos>({ lista: [], cobranca: null, entrega: null });
  const [popupEndereco, setPopupEndereco] = useState<"cobranca" | "entrega" | null>(null);
  // Marcado (padrão): entrega = cobrança, e o seletor de entrega some.
  const [entregaIgual, setEntregaIgual] = useState(true);

  const [telefones, setTelefones] = useState<TelefoneInput[]>([]);
  const [email, setEmail] = useState("");
  const [limiteCredito, setLimiteCredito] = useState("");

  const [contatos, setContatos] = useState<ContatoFormulario[]>([]);
  const [popupContato, setPopupContato] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const tamanhoDocumento = tipoPessoa === "Fisica" ? 11 : 14;
  const jaCadastrado = estadoDocumento.status === "ja-cadastrado";

  // ------------------------------------------------------------ documento
  function aoMudarTipo(fisica: boolean) {
    setTipoPessoa(fisica ? "Fisica" : "Juridica");
    setDocumento("");
    setDocumentoConsultado(null);
    setEstadoDocumento({ status: "idle" });
  }

  function aoMudarDocumento(valor: string) {
    const mascarado = aplicarMascaraDocumento(valor, tipoPessoa);
    setDocumento(mascarado);
    const normalizado = normalizarDocumento(mascarado);

    if (normalizado.length < tamanhoDocumento) {
      setDocumentoConsultado(null);
      setEstadoDocumento({ status: "idle" });
      return;
    }
    // Validação por cálculo ANTES de qualquer chamada ao backend.
    if (tipoPessoaDoDocumento(normalizado) !== tipoPessoa) {
      setDocumentoConsultado(null);
      setEstadoDocumento({
        status: "erro",
        mensagem: tipoPessoa === "Fisica" ? "CPF inválido." : "CNPJ inválido.",
      });
      return;
    }
    if (documentoConsultado === normalizado) {
      return;
    }
    void consultar(normalizado);
  }

  async function consultar(normalizado: string) {
    setDocumentoConsultado(normalizado);
    setEstadoDocumento({ status: "consultando" });
    const resposta = await consultarDocumentoAction(normalizado);

    switch (resposta.status) {
      case "cnpj":
        autopreencher(resposta.resultado);
        setEstadoDocumento({
          status: "ok",
          mensagem:
            resposta.resultado.origem === "API"
              ? "Dados da Receita Federal preenchidos."
              : "Dados preenchidos (consulta recente reaproveitada).",
        });
        break;
      case "cpf-livre":
        setEstadoDocumento({ status: "ok", mensagem: "CPF disponível para cadastro." });
        break;
      case "ja-cadastrado":
        setEstadoDocumento({ status: "ja-cadastrado", cliente: resposta.cliente });
        break;
      case "nao-encontrado":
        setEstadoDocumento({ status: "aviso", mensagem: resposta.mensagem });
        break;
      case "invalido":
        setEstadoDocumento({ status: "erro", mensagem: "Documento inválido." });
        break;
      case "limite":
      case "erro":
        // Libera pra reconsultar (botão "Tentar novamente").
        setDocumentoConsultado(null);
        setEstadoDocumento({ status: "erro", mensagem: resposta.mensagem });
        break;
    }
  }

  // Preenche só o que ainda está vazio - o usuário pode ter começado a digitar
  // antes da consulta voltar.
  function autopreencher(resultado: ConsultaCnpjResultadoDto) {
    const dados = resultado.dados;
    if (!dados) return;

    setRazaoSocial((atual) => atual || dados.razaoSocial);
    setNomeFantasia((atual) => atual || dados.nomeFantasia || "");
    setEmail((atual) => atual || dados.email || "");
    setTelefones((atual) => (atual.length > 0 ? atual : extrairTelefones(dados.telefone)));

    const sugerido = resultado.enderecoSugerido;
    if (sugerido?.cep && sugerido.logradouro) {
      const endereco: EnderecoFormulario = {
        cep: sugerido.cep,
        logradouro: sugerido.logradouro,
        numero: sugerido.numero ?? "",
        semNumero: sugerido.semNumero,
        complemento: sugerido.complemento ?? "",
        bairro: sugerido.bairro ?? "",
        cidade: sugerido.municipio ?? "",
        uf: sugerido.uf ?? "",
        codigoIbge: sugerido.codigoIbge,
        latitude: null,
        longitude: null,
      };
      // Mesmo endereço pra cobrança e entrega, como na tela de referência.
      setEnderecos((atual) => (atual.lista.length > 0 ? atual : { lista: [endereco], cobranca: 0, entrega: 0 }));
    }
  }

  // ------------------------------------------------------------- endereços
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

  // ------------------------------------------------------------------ salvar
  function validar(): string | null {
    const normalizado = normalizarDocumento(documento);
    if (tipoPessoaDoDocumento(normalizado) !== tipoPessoa) {
      return tipoPessoa === "Fisica" ? "Informe um CPF válido." : "Informe um CNPJ válido.";
    }
    if (jaCadastrado) {
      return "Este documento já está cadastrado.";
    }
    if (estadoDocumento.status === "consultando") {
      return "Aguarde a consulta do documento terminar.";
    }
    if (razaoSocial.trim() === "") {
      return tipoPessoa === "Fisica" ? "Informe o nome do cliente." : "Informe a razão social.";
    }
    if (enderecos.cobranca === null) {
      return "Defina o endereço de cobrança.";
    }
    if (!entregaIgual && enderecos.entrega === null) {
      return "Defina o endereço de entrega ou marque que é o mesmo da cobrança.";
    }
    if (contatos.length === 0) {
      return "Adicione pelo menos um contato.";
    }
    if (email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return "E-mail inválido.";
    }
    if (limiteCredito.trim() !== "" && parseValorMonetario(limiteCredito) === undefined) {
      return "Limite de crédito inválido.";
    }
    return null;
  }

  async function salvar() {
    const problema = validar();
    if (problema) {
      setErroSalvar(problema);
      return;
    }
    const cobranca = enderecos.lista[enderecos.cobranca!];
    const entrega = entregaIgual
      ? cobranca
      : enderecos.entrega !== null
        ? enderecos.lista[enderecos.entrega]
        : undefined;
    const fisica = tipoPessoa === "Fisica";
    const texto = (valor: string) => (valor.trim() === "" ? undefined : valor.trim());

    const payload: CriarClientePayload = {
      cpfCnpj: formatarDocumento(documento),
      codigo: texto(codigo),
      razaoSocial: razaoSocial.trim(),
      nomeFantasia: fisica ? undefined : texto(nomeFantasia),
      inscricaoEstadual: texto(inscricaoEstadual),
      ...(fisica
        ? { rg: texto(rg), dataNascimento: texto(dataNascimento), nomeMae: texto(nomeMae) }
        : {}),
      enderecoCobranca: enderecoParaPayload(cobranca),
      enderecoEntrega: entrega ? enderecoParaPayload(entrega) : undefined,
      telefones: telefones.length > 0 ? telefones : undefined,
      email: texto(email),
      limiteCredito: parseValorMonetario(limiteCredito),
      contatos: contatos.map(contatoParaPayload),
    };

    setSalvando(true);
    setErroSalvar(null);
    const resultado = await criarClienteAction(payload);
    if (resultado.status === "sucesso") {
      router.push(`/clientes/${resultado.cliente.id}`);
      return;
    }
    setSalvando(false);
    setErroSalvar(resultado.mensagem);
  }

  // ------------------------------------------------------------------ render
  const fisica = tipoPessoa === "Fisica";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/clientes" className="text-sm font-medium text-primary hover:underline">
          « Lista de clientes
        </Link>
        <div className="ml-auto flex gap-3">
          <PrimaryButton onClick={salvar} disabled={salvando || jaCadastrado}>
            {salvando ? "Salvando..." : "Salvar"}
          </PrimaryButton>
        </div>
      </div>

      {erroSalvar && (
        <Card>
          <MensagemErro>{erroSalvar}</MensagemErro>
        </Card>
      )}

      <Card className="flex flex-col gap-6">
        {/* Documento */}
        <div className="flex flex-wrap items-end gap-4">
          <Campo
            label={fisica ? "CPF" : "CNPJ"}
            value={documento}
            onChange={aoMudarDocumento}
            placeholder={fisica ? "Digite o CPF" : "Digite o CNPJ"}
            className="w-64"
            maxLength={18}
            dica={<FeedbackDocumento estado={estadoDocumento} onTentarNovamente={() => void consultar(normalizarDocumento(documento))} />}
          />
          <label className="flex items-center gap-2 pb-2 text-sm text-ink">
            <Switch checked={fisica} onChange={aoMudarTipo} label="Pessoa Física" />
            Pessoa Física
          </label>
          <Campo
            label="Código do cliente (Radar)"
            value={codigo}
            onChange={setCodigo}
            placeholder="Em branco: o Radar gera"
            className="w-56"
            maxLength={10}
          />
        </div>

        {/* Nomes */}
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

        {/* Endereços */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SeletorEndereco
              rotulo="Endereço de Cobrança"
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
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={entregaIgual}
              onChange={(evento) => setEntregaIgual(evento.target.checked)}
            />
            Endereço de entrega igual ao de cobrança
          </label>
        </div>

        {/* Contato e financeiro */}
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

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-base font-semibold text-ink">Contatos</h2>
            <span className="text-xs text-muted">Obrigatório: adicione pelo menos um contato.</span>
          </div>
          <SecondaryButton onClick={() => setPopupContato(true)}>Adicionar contato</SecondaryButton>
        </div>
        {contatos.length === 0 ? (
          <p className="text-sm text-muted">Nenhum contato adicionado.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {contatos.map((contato, indice) => (
              <li key={`${contato.nome}-${indice}`} className="flex items-center gap-3 rounded-card bg-background p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{contato.nome}</p>
                  <p className="truncate text-xs text-muted">
                    {[
                      contato.funcao,
                      contato.telefoneNumero
                        ? formatarTelefone({ ddd: contato.telefoneDdd, numero: contato.telefoneNumero })
                        : "",
                      contato.email,
                    ]
                      .filter((parte) => parte !== "")
                      .join(" · ") || "Sem outros dados"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setContatos((atuais) => atuais.filter((_, i) => i !== indice))}
                  aria-label={`Remover contato ${contato.nome}`}
                  className="text-sm text-muted hover:text-ink"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EnderecoPopup open={popupEndereco !== null} onCancelar={() => setPopupEndereco(null)} onSalvar={aoSalvarEndereco} />
      <ContatoPopup
        open={popupContato}
        onCancelar={() => setPopupContato(false)}
        onCriar={(contato) => {
          setContatos((atuais) => [...atuais, contato]);
          setPopupContato(false);
        }}
      />
    </div>
  );
}

function FeedbackDocumento({
  estado,
  onTentarNovamente,
}: {
  estado: EstadoDocumento;
  onTentarNovamente: () => void;
}) {
  switch (estado.status) {
    case "idle":
      return null;
    case "consultando":
      return <span className="text-xs text-muted">Consultando...</span>;
    case "ok":
      return <span className="text-xs text-muted">{estado.mensagem}</span>;
    case "aviso":
      return <span className="text-xs text-muted">{estado.mensagem}</span>;
    case "ja-cadastrado":
      return (
        <span className="text-xs font-medium text-ink">
          Já cadastrado
          {estado.cliente.razaoSocial ? ` (${estado.cliente.razaoSocial})` : ""}
          {estado.cliente.vendedorResponsavel ? ` - vendedor responsável: ${estado.cliente.vendedorResponsavel}` : ""}.
        </span>
      );
    case "erro":
      return (
        <span className="text-xs font-medium text-ink">
          {estado.mensagem}{" "}
          {!estado.mensagem.includes("inválido") && (
            <button type="button" onClick={onTentarNovamente} className="text-primary hover:underline">
              Tentar novamente
            </button>
          )}
        </span>
      );
  }
}
