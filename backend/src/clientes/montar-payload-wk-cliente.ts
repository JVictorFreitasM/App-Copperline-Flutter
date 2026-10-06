import type { TipoPessoa } from './domain/documento';

export interface TelefoneWk {
  ddd: string;
  numero: string;
}

export interface EnderecoParaWk {
  tipo: 'Padrao' | 'Entrega';
  cep: string;
  logradouro: string;
  numero?: number;
  semNumero: boolean;
  complemento?: string;
  bairro: string;
  idMunicipio: string;
  telefones: TelefoneWk[];
  email?: string;
}

export interface ContatoParaWk {
  nome: string;
  funcao?: string;
  email?: string;
  telefoneDdd?: string;
  telefoneNumero?: string;
  dataNascimento?: string;
}

export interface DadosCadastroParaWk {
  // id LOCAL do cliente - vai como codigoIntegrador, e' por ele que o sync
  // reconcilia a linha local com o cliente criado no Radar.
  clienteId: string;
  documentoFormatado: string;
  tipoPessoa: TipoPessoa;
  codigo?: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  // So pessoa fisica.
  rg?: string;
  dataNascimento?: string;
  nomeMae?: string;
  email?: string;
  limiteCredito?: number;
  suframa?: string;
  observacoes?: string;
  enderecos: EnderecoParaWk[];
  contatos: ContatoParaWk[];
  // idExternoErp do vendedor responsavel - sem ele o sync apagaria o vinculo
  // cliente<->vendedor na proxima execucao (ele e' recriado a partir de
  // detalhes.idVendedores).
  vendedorIdExterno: string | null;
}

// Corpo de UM cliente do POST /api/empresarial/v1/cliente (o endpoint recebe
// um ARRAY). So inclui o que foi informado - campo ausente fica de fora em vez
// de ir "" ou 0. Funcao pura (sem Prisma/HTTP), testada isolada.
//
// Campos do swagger que NAO preenchemos de proposito: tipoICMS/categoriaFiscal
// (enums sem valor confirmado), classificacao, categorias, tabela de preco e
// condicoes de pagamento (sem mapeamento definido com o usuario).
export function montarPayloadWkCliente(dados: DadosCadastroParaWk) {
  return {
    codigoIntegrador: dados.clienteId,
    ...(dados.codigo ? { codigo: dados.codigo } : {}),
    cpfCnpj: dados.documentoFormatado,
    tipoPessoa: dados.tipoPessoa,
    razaoSocial: dados.razaoSocial,
    ...(dados.nomeFantasia ? { nomeFantasia: dados.nomeFantasia } : {}),
    ...(dados.email ? { email: dados.email } : {}),
    enderecos: dados.enderecos.map((endereco) => ({
      tipo: endereco.tipo,
      cep: endereco.cep,
      nomeEndereco: endereco.logradouro,
      semNumero: endereco.semNumero,
      ...(endereco.semNumero ? {} : { numero: endereco.numero ?? 0 }),
      ...(endereco.complemento ? { complemento: endereco.complemento } : {}),
      bairro: endereco.bairro,
      idMunicipio: endereco.idMunicipio,
      telefones: endereco.telefones,
      ...(endereco.email ? { email: endereco.email } : {}),
    })),
    ...(dados.inscricaoEstadual || dados.suframa
      ? {
          inscricoesLegais: {
            ...(dados.inscricaoEstadual
              ? { inscricaoEstadual: dados.inscricaoEstadual }
              : {}),
            ...(dados.suframa ? { registroSuframa: dados.suframa } : {}),
          },
        }
      : {}),
    ...(dados.tipoPessoa === 'Fisica' &&
    (dados.rg || dados.dataNascimento || dados.nomeMae)
      ? {
          informacoesCadastrais: {
            ...(dados.rg ? { rg: dados.rg } : {}),
            ...(dados.dataNascimento ? { dataNascimento: dados.dataNascimento } : {}),
            ...(dados.nomeMae ? { nomeMae: dados.nomeMae } : {}),
          },
        }
      : {}),
    ...(dados.limiteCredito !== undefined
      ? { informacoesFinanceiras: { limiteCredito: dados.limiteCredito } }
      : {}),
    ...(dados.observacoes
      ? { informacoesExtras: { anotacoesGerais: dados.observacoes } }
      : {}),
    ...(dados.vendedorIdExterno
      ? { detalhes: { idVendedores: [dados.vendedorIdExterno] } }
      : {}),
    ...(dados.contatos.length > 0
      ? {
          contatos: dados.contatos.map((contato) => ({
            nome: contato.nome,
            ...(contato.funcao ? { funcao: contato.funcao } : {}),
            ...(contato.email ? { email: contato.email } : {}),
            ...(contato.telefoneDdd ? { telefoneDDD: contato.telefoneDdd } : {}),
            ...(contato.telefoneNumero
              ? { telefoneNumero: contato.telefoneNumero }
              : {}),
            ...(contato.dataNascimento
              ? { dataNascimento: contato.dataNascimento }
              : {}),
          })),
        }
      : {}),
  };
}

export type PayloadWkCliente = ReturnType<typeof montarPayloadWkCliente>;
