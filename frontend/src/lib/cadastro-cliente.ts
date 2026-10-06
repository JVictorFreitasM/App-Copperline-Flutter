import { cnpjEhValido, formatarCnpj, normalizarCnpj } from "./consulta-cnpj";

// Mesmo contrato de backend/src/clientes/dto/criar-cliente.dto.ts (POST
// /clientes) e de consulta-cnpj/consulta-cep/geocodificacao - duplicado aqui
// por não haver pacote compartilhado entre front e back.

export type TipoPessoa = "Fisica" | "Juridica";

export interface TelefoneInput {
  ddd: string;
  numero: string;
}

export interface GeocodificacaoDto {
  latitude: number;
  longitude: number;
  nomeExibicao: string;
}

export interface ClienteCriadoDto {
  id: string;
  statusEnvioErp: "PENDENTE" | "ENVIADO" | "ERRO";
}

// ---------------------------------------------------------------- documento
// Validação por cálculo no navegador, ANTES de qualquer chamada: feedback
// imediato e economia de requisição do provedor externo (o backend valida de
// novo - o front não é confiável). CNPJ reaproveita lib/consulta-cnpj.ts.

function cpfEhValido(entrada: string): boolean {
  const cpf = entrada.replace(/[.\-\s]/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }
  const digito = (base: string, pesoInicial: number): number => {
    const soma = [...base].reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export function normalizarDocumento(entrada: string): string {
  return normalizarCnpj(entrada);
}

// 11 dígitos = CPF (física), 14 caracteres = CNPJ (jurídica); null = inválido.
export function tipoPessoaDoDocumento(entrada: string): TipoPessoa | null {
  const documento = normalizarDocumento(entrada);
  if (documento.length === 11) {
    return cpfEhValido(documento) ? "Fisica" : null;
  }
  return cnpjEhValido(documento) ? "Juridica" : null;
}

export function formatarDocumento(entrada: string): string {
  const documento = normalizarDocumento(entrada);
  if (documento.length === 11) {
    return `${documento.slice(0, 3)}.${documento.slice(3, 6)}.${documento.slice(6, 9)}-${documento.slice(9)}`;
  }
  return formatarCnpj(documento);
}

// Máscara progressiva enquanto digita: até 11 dígitos numéricos mostra CPF,
// depois vira CNPJ (aceita letras - formato alfanumérico novo).
export function aplicarMascaraDocumento(entrada: string, tipo: TipoPessoa): string {
  const limpo = normalizarDocumento(entrada);
  if (tipo === "Fisica") {
    const d = limpo.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  const c = limpo.slice(0, 14);
  return c
    .replace(/^([0-9A-Z]{2})([0-9A-Z])/, "$1.$2")
    .replace(/^([0-9A-Z]{2})\.([0-9A-Z]{3})([0-9A-Z])/, "$1.$2.$3")
    .replace(/^([0-9A-Z]{2})\.([0-9A-Z]{3})\.([0-9A-Z]{3})([0-9A-Z])/, "$1.$2.$3/$4")
    .replace(/^([0-9A-Z]{2})\.([0-9A-Z]{3})\.([0-9A-Z]{3})\/([0-9A-Z]{4})([0-9A-Z])/, "$1.$2.$3/$4-$5");
}

// ----------------------------------------------------------------- endereço
export interface EnderecoFormulario {
  cep: string;
  logradouro: string;
  numero: string;
  semNumero: boolean;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigoIbge: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function enderecoVazio(): EnderecoFormulario {
  return {
    cep: "",
    logradouro: "",
    numero: "",
    semNumero: false,
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    codigoIbge: null,
    latitude: null,
    longitude: null,
  };
}

export function formatarCep(entrada: string): string {
  const d = entrada.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function enderecoEstaCompleto(endereco: EnderecoFormulario): boolean {
  return (
    endereco.cep.replace(/\D/g, "").length === 8 &&
    endereco.logradouro.trim() !== "" &&
    endereco.bairro.trim() !== "" &&
    (endereco.semNumero || /^\d+$/.test(endereco.numero.trim()))
  );
}

// Duas linhas, como no mock de referência: "AVENIDA X, 391, BAIRRO" e
// "64003-600 - TERESINA - PI - Brasil".
export function descreverEndereco(endereco: EnderecoFormulario): [string, string] {
  const primeira = [endereco.logradouro, endereco.semNumero ? "S/N" : endereco.numero, endereco.bairro]
    .filter((parte) => parte.trim() !== "")
    .join(", ");
  const segunda = [formatarCep(endereco.cep), endereco.cidade, endereco.uf, "Brasil"]
    .filter((parte) => parte.trim() !== "")
    .join(" - ");
  return [primeira, segunda];
}

// Texto único pro "Localizar" (geocodificação) - do mais específico pro mais
// geral; o backend aceita qualquer texto livre.
export function consultaDeLocalizacao(endereco: EnderecoFormulario): string[] {
  const cidadeUf = [endereco.cidade, endereco.uf].filter((p) => p.trim() !== "").join(" - ");
  const completa = [
    endereco.logradouro,
    endereco.semNumero ? "" : endereco.numero,
    endereco.bairro,
    cidadeUf,
    formatarCep(endereco.cep),
  ]
    .filter((parte) => parte.trim() !== "")
    .join(", ");
  const semNumero = [endereco.logradouro, endereco.bairro, cidadeUf]
    .filter((parte) => parte.trim() !== "")
    .join(", ");
  const soCep = [formatarCep(endereco.cep), cidadeUf].filter((parte) => parte.trim() !== "").join(", ");
  return [...new Set([completa, semNumero, soCep])].filter((texto) => texto.length >= 5);
}

// ----------------------------------------------------------------- telefone
export function formatarTelefone(telefone: TelefoneInput): string {
  const { ddd, numero } = telefone;
  const corte = numero.length - 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

export function telefoneEhValido(telefone: TelefoneInput): boolean {
  return /^\d{2}$/.test(telefone.ddd) && /^\d{8,9}$/.test(telefone.numero);
}

// A Receita devolve "(86) 3218-8383" ou vários separados por "/" - extrai só
// o que tem DDD + 8/9 dígitos (o que o Radar aceita).
export function extrairTelefones(texto: string | null): TelefoneInput[] {
  if (!texto) return [];
  const encontrados: TelefoneInput[] = [];
  for (const trecho of texto.split(/[/;,]|\s{2,}| e /)) {
    const digitos = trecho.replace(/\D/g, "");
    if (digitos.length === 10 || digitos.length === 11) {
      encontrados.push({ ddd: digitos.slice(0, 2), numero: digitos.slice(2) });
    }
  }
  return encontrados;
}

// ------------------------------------------------------------------ contato
export interface ContatoFormulario {
  nome: string;
  funcao: string;
  email: string;
  telefoneDdd: string;
  telefoneNumero: string;
  dataNascimento: string;
}

export function contatoVazio(): ContatoFormulario {
  return { nome: "", funcao: "", email: "", telefoneDdd: "", telefoneNumero: "", dataNascimento: "" };
}

// ------------------------------------------------------------ payload do POST
export interface EnderecoPayload {
  cep: string;
  logradouro: string;
  numero?: number;
  semNumero: boolean;
  complemento?: string;
  bairro: string;
  codigoIbge?: string;
  cidade?: string;
  uf?: string;
  latitude?: number;
  longitude?: number;
}

export interface CriarClientePayload {
  cpfCnpj: string;
  codigo?: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  rg?: string;
  dataNascimento?: string;
  nomeMae?: string;
  enderecoCobranca: EnderecoPayload;
  enderecoEntrega?: EnderecoPayload;
  telefones?: TelefoneInput[];
  email?: string;
  limiteCredito?: number;
  // Pelo menos um contato e obrigatorio (o backend recusa sem).
  contatos: {
    nome: string;
    funcao?: string;
    email?: string;
    telefoneDdd?: string;
    telefoneNumero?: string;
    dataNascimento?: string;
  }[];
}

const ouUndefined = (valor: string): string | undefined => (valor.trim() === "" ? undefined : valor.trim());

export function enderecoParaPayload(endereco: EnderecoFormulario): EnderecoPayload {
  return {
    cep: endereco.cep.replace(/\D/g, ""),
    logradouro: endereco.logradouro.trim(),
    semNumero: endereco.semNumero,
    ...(endereco.semNumero ? {} : { numero: Number(endereco.numero) }),
    complemento: ouUndefined(endereco.complemento),
    bairro: endereco.bairro.trim(),
    ...(endereco.codigoIbge ? { codigoIbge: endereco.codigoIbge } : {}),
    cidade: ouUndefined(endereco.cidade),
    ...(/^[A-Za-z]{2}$/.test(endereco.uf) ? { uf: endereco.uf } : {}),
    ...(endereco.latitude !== null && endereco.longitude !== null
      ? { latitude: endereco.latitude, longitude: endereco.longitude }
      : {}),
  };
}

export function contatoParaPayload(contato: ContatoFormulario) {
  return {
    nome: contato.nome.trim(),
    funcao: ouUndefined(contato.funcao),
    email: ouUndefined(contato.email),
    telefoneDdd: ouUndefined(contato.telefoneDdd),
    telefoneNumero: ouUndefined(contato.telefoneNumero),
    dataNascimento: ouUndefined(contato.dataNascimento),
  };
}

// Aceita "1.234,56" e "1234.56" - o campo é digitado à mão, em pt-BR.
export function parseValorMonetario(texto: string): number | undefined {
  const limpo = texto.trim();
  if (limpo === "") return undefined;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) / 100 : undefined;
}
