import {
  enderecosIguais,
  enderecoWkParaRadar,
  type EnderecoParaWk,
} from '../endereco-wk';

// Regras da EDICAO de cliente (funcoes puras, sem Prisma/HTTP):
//   1. calcularIntencao: compara o que a tela mandou com o que temos e guarda
//      SO o que mudou (a "intencao") - nada que o usuario nao tocou vai ao ERP;
//   2. aplicarNoPayloadDeCriacao: cliente que ainda nao chegou ao Radar - a
//      edicao reescreve o corpo do POST que ainda vai ser enviado;
//   3. montarPatchWk: cliente que ja esta no Radar - monta o corpo do PATCH a
//      partir do cliente ATUAL no Radar, mandando cada bloco tocado COMPLETO
//      (o comportamento do PATCH com bloco parcial nao e documentado; um bloco
//      parcial poderia apagar os campos que nao editamos).

const CAMPOS_TEXTO = [
  'razaoSocial',
  'nomeFantasia',
  'email',
  'inscricaoEstadual',
  'rg',
  'dataNascimento',
  'nomeMae',
] as const;
type CampoTexto = (typeof CAMPOS_TEXTO)[number];

// O que a tela de edicao mexe, no estado atual (banco local).
export interface EstadoEditavel {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  email: string | null;
  inscricaoEstadual: string | null;
  limiteCredito: number | null;
  // So conhecidos pra cliente cadastrado por nos (o sync nao grava esses).
  rg: string | null;
  dataNascimento: string | null;
  nomeMae: string | null;
  enderecos: EnderecoParaWk[];
}

// Valores desejados (undefined = nao informado, nao mexe; '' = limpar).
export interface IntencaoAlteracao {
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  inscricaoEstadual?: string;
  rg?: string;
  dataNascimento?: string;
  nomeMae?: string;
  limiteCredito?: number;
  // Enderecos (por tipo) que mudaram, COMPLETOS.
  enderecos?: EnderecoParaWk[];
}

export type ValoresDesejados = IntencaoAlteracao;

const normalizar = (valor: string | null | undefined): string => (valor ?? '').trim();

export function calcularIntencao(
  atual: EstadoEditavel,
  desejado: ValoresDesejados,
): IntencaoAlteracao {
  const intencao: IntencaoAlteracao = {};

  for (const campo of CAMPOS_TEXTO) {
    const valor = desejado[campo];
    if (valor !== undefined && normalizar(valor) !== normalizar(atual[campo])) {
      intencao[campo as CampoTexto] = valor.trim();
    }
  }

  if (
    desejado.limiteCredito !== undefined &&
    desejado.limiteCredito !== atual.limiteCredito
  ) {
    intencao.limiteCredito = desejado.limiteCredito;
  }

  const enderecosMudados = (desejado.enderecos ?? []).filter((desejadoTipo) => {
    const atualTipo = atual.enderecos.find((e) => e.tipo === desejadoTipo.tipo);
    return !atualTipo || !enderecosIguais(atualTipo, desejadoTipo);
  });
  if (enderecosMudados.length > 0) {
    intencao.enderecos = enderecosMudados;
  }

  return intencao;
}

export function intencaoVazia(intencao: IntencaoAlteracao): boolean {
  return Object.keys(intencao).length === 0;
}

type Objeto = Record<string, unknown>;

function aplicarCampo(alvo: Objeto, chave: string, valor: string | number | undefined) {
  if (valor === undefined) return;
  if (valor === '') {
    delete alvo[chave];
  } else {
    alvo[chave] = valor;
  }
}

function aplicarNoBloco(
  raiz: Objeto,
  bloco: string,
  chave: string,
  valor: string | number | undefined,
) {
  if (valor === undefined) return;
  const atual = (raiz[bloco] as Objeto | undefined) ?? {};
  aplicarCampo(atual, chave, valor);
  if (Object.keys(atual).length === 0) {
    delete raiz[bloco];
  } else {
    raiz[bloco] = atual;
  }
}

function substituirEnderecos(
  enderecosAtuais: unknown,
  novos: EnderecoParaWk[],
): Objeto[] {
  const lista = (Array.isArray(enderecosAtuais) ? enderecosAtuais : []) as Objeto[];
  const resultado = [...lista];
  for (const novo of novos) {
    const corpo = enderecoWkParaRadar(novo);
    const indice = resultado.findIndex((e) => e.tipo === novo.tipo);
    if (indice === -1) {
      resultado.push(corpo);
    } else {
      resultado[indice] = corpo;
    }
  }
  return resultado;
}

// Cadastro ainda nao enviado (ou recusado) pelo Radar: a edicao entra no corpo
// do POST que ainda vai ser enviado. Nao muda o original (devolve copia).
export function aplicarNoPayloadDeCriacao(
  payload: Objeto,
  intencao: IntencaoAlteracao,
): Objeto {
  const novo = JSON.parse(JSON.stringify(payload)) as Objeto;

  aplicarCampo(novo, 'razaoSocial', intencao.razaoSocial);
  aplicarCampo(novo, 'nomeFantasia', intencao.nomeFantasia);
  aplicarCampo(novo, 'email', intencao.email);
  aplicarNoBloco(novo, 'inscricoesLegais', 'inscricaoEstadual', intencao.inscricaoEstadual);
  aplicarNoBloco(novo, 'informacoesFinanceiras', 'limiteCredito', intencao.limiteCredito);
  if (novo.tipoPessoa === 'Fisica') {
    aplicarNoBloco(novo, 'informacoesCadastrais', 'rg', intencao.rg);
    aplicarNoBloco(novo, 'informacoesCadastrais', 'dataNascimento', intencao.dataNascimento);
    aplicarNoBloco(novo, 'informacoesCadastrais', 'nomeMae', intencao.nomeMae);
  }
  if (intencao.enderecos?.length) {
    novo.enderecos = substituirEnderecos(novo.enderecos, intencao.enderecos);
  }
  return novo;
}

// --------------------------------------------------------------- PATCH Radar

// Subconjunto do GET /empresarial/v1/cliente/{id} (ReadClienteDto) que o PATCH
// precisa pra mandar os blocos completos.
export interface ClienteRadarAtual {
  enderecos?: Objeto[] | null;
  inscricoesLegais?: Objeto | null;
  informacoesCadastrais?: Objeto | null;
  informacoesFinanceiras?: Objeto | null;
}

// Chaves aceitas pelo UpdateClienteDto do swagger - o GET devolve mais (ex:
// endereco com uf/codigoIBGE/idTransportadora), que o PATCH nao conhece.
const CAMPOS_INSCRICOES = [
  'tipoICMS',
  'inscricaoEstadual',
  'categoriaFiscal',
  'cnaePrincipal',
  'inscricaoMunicipal',
  'codigoAtividadeMunicipal',
  'registroSuframa',
];
const CAMPOS_CADASTRAIS = [
  'rg',
  'orgaoEmissor',
  'uf',
  'tipoICMS',
  'inscricaoEstadualProdutor',
  'sexo',
  'estadoCivil',
  'dataNascimento',
  'nomePai',
  'nomeMae',
  'naturalidade',
  'nacionalidade',
  'paisOrigem',
  'numeroPIS',
];
const CAMPOS_FINANCEIRAS = [
  'clienteDesde',
  'dataLimiteCredito',
  'limiteCredito',
  'descontoFinanceiro',
  'tipoDescontoFinanceiro',
  'desconto',
  'tipoDesconto',
];
const CAMPOS_ENDERECO = [
  'tipo',
  'cep',
  'nomeEndereco',
  'semNumero',
  'numero',
  'complemento',
  'bairro',
  'idMunicipio',
  'email',
];

// "2004-12-10T00:00:00" -> "2004-12-10" (o Update espera `date`).
function normalizarValor(valor: unknown): unknown {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)
    ? valor.slice(0, 10)
    : valor;
}

function copiarCampos(origem: Objeto | null | undefined, campos: string[]): Objeto {
  const copia: Objeto = {};
  for (const campo of campos) {
    if (origem && origem[campo] !== undefined) {
      copia[campo] = normalizarValor(origem[campo]);
    }
  }
  return copia;
}

function enderecoRadarParaUpdate(endereco: Objeto): Objeto {
  const telefones = Array.isArray(endereco.telefones) ? (endereco.telefones as Objeto[]) : [];
  return {
    ...copiarCampos(endereco, CAMPOS_ENDERECO),
    telefones: telefones.map((telefone) => ({ ddd: telefone.ddd, numero: telefone.numero })),
  };
}

function blocoCompleto(
  atual: Objeto | null | undefined,
  campos: string[],
  alteracoes: Record<string, string | number | undefined>,
): Objeto {
  const bloco = copiarCampos(atual, campos);
  for (const [chave, valor] of Object.entries(alteracoes)) {
    if (valor !== undefined) bloco[chave] = valor;
  }
  return bloco;
}

export function montarPatchWk(
  atual: ClienteRadarAtual,
  intencao: IntencaoAlteracao,
): Objeto {
  const patch: Objeto = {};

  if (intencao.razaoSocial !== undefined) patch.razaoSocial = intencao.razaoSocial;
  if (intencao.nomeFantasia !== undefined) patch.nomeFantasia = intencao.nomeFantasia;
  if (intencao.email !== undefined) patch.email = intencao.email;

  if (intencao.inscricaoEstadual !== undefined) {
    patch.inscricoesLegais = blocoCompleto(atual.inscricoesLegais, CAMPOS_INSCRICOES, {
      inscricaoEstadual: intencao.inscricaoEstadual,
    });
  }
  if (
    intencao.rg !== undefined ||
    intencao.dataNascimento !== undefined ||
    intencao.nomeMae !== undefined
  ) {
    patch.informacoesCadastrais = blocoCompleto(
      atual.informacoesCadastrais,
      CAMPOS_CADASTRAIS,
      { rg: intencao.rg, dataNascimento: intencao.dataNascimento, nomeMae: intencao.nomeMae },
    );
  }
  if (intencao.limiteCredito !== undefined) {
    patch.informacoesFinanceiras = blocoCompleto(
      atual.informacoesFinanceiras,
      CAMPOS_FINANCEIRAS,
      { limiteCredito: intencao.limiteCredito },
    );
  }
  if (intencao.enderecos?.length) {
    // Lista COMPLETA (os do Radar + os editados por tipo): seguro se o PATCH
    // substituir a lista inteira e tambem se ele mesclar por tipo.
    const atuais = (atual.enderecos ?? []).map(enderecoRadarParaUpdate);
    patch.enderecos = substituirEnderecos(atuais, intencao.enderecos);
  }

  return patch;
}
