// Mesmo shape de backend/src/clientes/dto/cliente-response.dto.ts
// (ClienteResumoDto) - duplicado aqui por não haver pacote compartilhado
// entre front e back (mesmo padrão de CurrentUser em auth.ts).
export interface ClienteResumoDto {
  id: string;
  idExternoErp: string;
  cpfCnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inativo: boolean;
  incompleto: boolean;
  sincronizadoEm: string;
  // Cadastro feito por nós: PENDENTE/ERRO até o WK Radar aceitar (ver
  // /clientes/novo). Cliente do sync é sempre ENVIADO.
  statusEnvioErp: "PENDENTE" | "ENVIADO" | "ERRO";
  erroEnvioErp: string | null;
}

export interface ContatoClienteDto {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneDdd: string | null;
  telefoneNumero: string | null;
  funcao: string | null;
  criadoLocalmente: boolean;
}

export interface TelefoneEnderecoDto {
  ddd: string | null;
  numero: string;
}

// Já normalizado pelo backend (paraEnderecosClienteDto) a partir do JSONB
// cru do WK Radar - o front só renderiza. Sem nome de cidade: o Radar só
// manda idMunicipio/codigoIBGE.
export interface EnderecoClienteDto {
  tipo: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  uf: string | null;
  email: string | null;
  telefones: TelefoneEnderecoDto[];
}

export interface ClienteDetalheDto extends ClienteResumoDto {
  codigo: string | null;
  email: string | null;
  contato: string | null;
  homepage: string | null;
  inscricaoEstadual: string | null;
  enderecos: EnderecoClienteDto[];
  contatos: ContatoClienteDto[];
  // Última edição ainda não aplicada no WK Radar (PENDENTE na fila ou ERRO).
  alteracaoErp: {
    status: "PENDENTE" | "ERRO";
    erro: string | null;
    criadoEm: string;
  } | null;
}

// Mesmo shape de backend/src/clientes/cliente-estatisticas.service.ts
// (ClienteEstatisticasDto, GET /clientes/:id/estatisticas) - totais,
// ticketMedio e vendedorResponsavel já vêm calculados pelo backend
// (agregado sobre Pedido, nunca NotaFiscal - ver comentário no service);
// o front só formata pra exibição, nunca soma/divide nada (critério de
// aceite da OS-WEB-23: "sem cálculo duplicado no front").
export interface ClienteEstatisticasDto {
  clienteId: string;
  meses: number;
  totalUltimosMeses: number;
  totalGeral: number;
  quantidadePedidos: number;
  ticketMedio: number;
  vendedorResponsavel: string | null;
}

// Mesmo shape de backend/src/clientes/cliente-financeiro.service.ts
// (ClienteFinanceiroDto, GET /clientes/:id/financeiro, OS-BACKEND-36
// revisão) - fonte é BuscarPosicaoFinanceira (SOAP Financeiro.svc), não
// mais somatório manual de título REST. Consultado ao vivo a cada chamada
// (dado transacional, nunca cacheado localmente).
export interface ClienteFinanceiroDto {
  clienteId: string;
  limiteCredito: number;
  limiteCreditoSerasa: number;
  creditoDisponivel: number;
  creditoUtilizado: number;
  saldoAVencer: number;
  saldoVencido: number;
  maiorAtraso: number;
  mediaAtraso: number;
  qtdeBaixasPorInadimplencia: number;
  totalDeCompras: number;
  dataUltimaFatura: string | null;
  vendaBloqueada: boolean;
  inadimplente: boolean;
}
