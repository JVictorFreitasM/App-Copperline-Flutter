import type { TipoPessoa } from './domain/documento';
import { enderecoWkParaRadar, type EnderecoParaWk } from './endereco-wk';

export type { EnderecoParaWk, TelefoneWk } from './endereco-wk';

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
// (enums sem valor confirmado), classificacao, categorias, tabela de preco,
// condicoes de pagamento, Suframa e anotacoes gerais (sem mapeamento definido
// com o usuario, ou retirados da tela).
export function montarPayloadWkCliente(dados: DadosCadastroParaWk) {
  return {
    codigoIntegrador: dados.clienteId,
    ...(dados.codigo ? { codigo: dados.codigo } : {}),
    cpfCnpj: dados.documentoFormatado,
    tipoPessoa: dados.tipoPessoa,
    razaoSocial: dados.razaoSocial,
    ...(dados.nomeFantasia ? { nomeFantasia: dados.nomeFantasia } : {}),
    ...(dados.email ? { email: dados.email } : {}),
    enderecos: dados.enderecos.map(enderecoWkParaRadar),
    ...(dados.inscricaoEstadual
      ? { inscricoesLegais: { inscricaoEstadual: dados.inscricaoEstadual } }
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
