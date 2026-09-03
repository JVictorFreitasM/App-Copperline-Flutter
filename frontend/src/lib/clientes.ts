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
}

export interface ContatoClienteDto {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneDdd: string | null;
  telefoneNumero: string | null;
  funcao: string | null;
}

// `enderecos` é `unknown` no backend também (JSONB repassado cru do WK
// Radar, sem schema estável - ver schema.prisma) - não fingir um shape
// aqui que não temos como garantir.
export interface ClienteDetalheDto extends ClienteResumoDto {
  enderecos: unknown;
  contatos: ContatoClienteDto[];
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
