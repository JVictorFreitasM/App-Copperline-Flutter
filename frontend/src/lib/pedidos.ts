// Mesmo shape de backend/src/pedidos/dto/pedido-response.dto.ts
// (PedidoResumoDto/ClienteResumoPedidoDto) - duplicado aqui por não haver
// pacote compartilhado entre front e back. GET /pedidos já inclui o
// cliente (nome resolvido via `include: { cliente: true }` no
// PedidosService) - não precisa de uma segunda chamada/join no front.
export interface ClienteResumoPedidoDto {
  id: string;
  razaoSocial: string | null;
}

export interface VendedorResumoPedidoDto {
  id: string;
  nome: string | null;
}

export interface PedidoResumoDto {
  id: string;
  idExternoErp: string | null;
  numero: string | null;
  situacao: string | null;
  dataHoraUltimaAlteracao: string | null;
  // Tela de listagem (layout de referência) - "Data de Criação", vem do
  // Radar (dataEmissao). Null pra pedido criado localmente.
  dataEmissao: string | null;
  // "Localização" (filtro) - UF do endereço de entrega, só ~7% dos
  // pedidos tem esse dado no Radar.
  ufEntrega: string | null;
  valorTotal: string | null;
  incompleto: boolean;
  sincronizadoEm: string;
  cliente: ClienteResumoPedidoDto | null;
  // Vendedor DO PEDIDO sincronizado (Radar), não quem criou localmente.
  vendedor: VendedorResumoPedidoDto | null;
  // Ícone de exclamação no layout de referência - solicitação de desconto
  // aguardando aprovação (confirmado com o usuário).
  temSolicitacaoDescontoPendente: boolean;
  // Mesmo bucket dos atalhos/filtro da listagem, tambem exibido como
  // "Status da aprovação" na tela de detalhe (ref1.jpeg) - ver rótulos em
  // OPCOES_STATUS_APROVACAO abaixo.
  statusAprovacaoBucket: "NAO_INTEGRADO" | "AGUARDANDO_APROVACAO" | "ENVIADO" | "ORCAMENTO";
}

// Valores possíveis vêm do enum TipoSituacaoPedido do backend
// (schema.prisma). Só dois tons (ver skill design-system: "preto/cinza
// para estados neutros... não introduzir verde/vermelho sem necessidade
// real") - `enfase` destaca só o que já concluiu (faturado/atendido),
// tudo mais fica no chip neutro. Não é mais um mapa "uma cor por status".
const CONFIG_SITUACAO: Record<string, { rotulo: string; enfase: boolean }> = {
  EM_ANALISE: { rotulo: "Em análise", enfase: false },
  BLOQUEADO: { rotulo: "Bloqueado", enfase: false },
  PENDENTE: { rotulo: "Pendente", enfase: false },
  CANCELADO: { rotulo: "Cancelado", enfase: false },
  PARCIALMENTE_FATURADO: { rotulo: "Parcialmente faturado", enfase: false },
  FATURADO: { rotulo: "Faturado", enfase: true },
  PARCIALMENTE_ATENDIDO: { rotulo: "Parcialmente atendido", enfase: false },
  ATENDIDO: { rotulo: "Atendido", enfase: true },
};

export function configSituacaoPedido(situacao: string | null): {
  rotulo: string;
  enfase: boolean;
} {
  if (!situacao) {
    return { rotulo: "—", enfase: false };
  }
  return CONFIG_SITUACAO[situacao] ?? { rotulo: situacao, enfase: false };
}

// Opções pro <select> de filtro por situação (OS-WEB-15) - mesmos valores
// que o backend aceita em ListarPedidosQueryDto.situacao (enum
// TipoSituacaoPedido), na mesma ordem/rótulo de CONFIG_SITUACAO acima.
export const OPCOES_SITUACAO_PEDIDO = Object.entries(CONFIG_SITUACAO).map(
  ([valor, { rotulo }]) => ({ valor, rotulo }),
);

// "Status de aprovação" (layout de referência) - bucket derivado do fluxo
// local de criação (ver backend/src/pedidos/dto/listar-pedidos-query.dto.ts
// pra semântica exata de cada valor). NAO_INTEGRADO era rotulado
// "Orçamento" antes do Épico 4 (era só um apelido, sem entidade real por
// trás) - agora ORCAMENTO é um bucket de verdade próprio, então
// NAO_INTEGRADO volta a ser rotulado pelo que ele é.
export const OPCOES_STATUS_APROVACAO = [
  { valor: "NAO_INTEGRADO", rotulo: "Não integrado" },
  { valor: "AGUARDANDO_APROVACAO", rotulo: "Aguardando aprovação" },
  { valor: "ENVIADO", rotulo: "Enviado" },
  { valor: "ORCAMENTO", rotulo: "Orçamento" },
] as const;

export function rotuloStatusAprovacaoPedido(
  bucket: PedidoResumoDto["statusAprovacaoBucket"],
): string {
  return OPCOES_STATUS_APROVACAO.find((opcao) => opcao.valor === bucket)?.rotulo ?? bucket;
}

export const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export interface ProdutoResumoPedidoDto {
  id: string;
  nome: string | null;
  codigo: string | null;
  pesoLiquidoKg: string | null;
  pesoBrutoKg: string | null;
}

// Revisao por item (tela de detalhe do pedido, layout de referencia
// ref1.jpeg) - distinto de SolicitacaoDesconto (que decide o pedido
// INTEIRO de uma vez, ver /aprovacoes): aqui cada item tem seu proprio
// status, decidido pelos botoes X/check da tabela ou por "Aprovar tudo"/
// "Reprovar tudo" no topo.
export interface PedidoItemDto {
  id: string;
  numero: number;
  idItemGrade1: string | null;
  idItemGrade2: string | null;
  idItemGrade3: string | null;
  quantidadeVenda: string | null;
  unidade: string | null;
  valorUnitario: string | null;
  valorTotal: string | null;
  situacao: string | null;
  produto: ProdutoResumoPedidoDto | null;
  statusAprovacao: "PENDENTE" | "APROVADO" | "REJEITADO";
  decididoPor: { id: string; nome: string } | null;
  decididoEm: string | null;
  observacoes: string | null;
}

export interface ContatoClientePedidoDto {
  id: string;
  nome: string | null;
  telefoneDdd: string | null;
  telefoneNumero: string | null;
}

// Endereco cru vindo do WK Radar (ver WkRadarEndereco no backend) - so os
// campos que a tela de detalhe usa; idMunicipio nao vira nome de cidade
// (sem catalogo de municipios sincronizado, so UF via
// resolverUfEntrega no backend).
export interface EnderecoClientePedidoDto {
  cep?: string | null;
  nomeEndereco?: string | null;
  numero?: number | null;
  complemento?: string | null;
  bairro?: string | null;
  uf?: string | null;
}

export interface ClienteDetalhePedidoDto {
  id: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cpfCnpj: string | null;
  codigoIntegrador: string | null;
  enderecos: EnderecoClientePedidoDto[];
  contatos: ContatoClientePedidoDto[];
}

export interface FormaPagamentoResumoPedidoDto {
  id: string;
  codigo: string | null;
  descricao: string | null;
}

export interface CondicaoPagamentoResumoPedidoDto {
  id: string;
  codigo: string | null;
  nome: string | null;
}

// Nota fiscal vinculada ao pedido (N:N - um pedido pode ter mais de uma,
// ex: faturamento parcial). `chave` null = sem NF-e sincronizada pra essa
// nota (ex: só NFS-e, fora de escopo) - front usa isso pra decidir se
// mostra o link de PDF sem precisar tentar a chamada primeiro.
export interface NotaFiscalResumoPedidoDto {
  id: string;
  numero: number | null;
  serie: string | null;
  chave: string | null;
  dataEmissao: string | null;
  statusNfe: string | null;
  valorTotalNotaFiscal: string | null;
}

export interface PedidoDetalheDto extends Omit<PedidoResumoDto, "cliente"> {
  cliente: ClienteDetalhePedidoDto | null;
  itens: PedidoItemDto[];
  pesoLiquidoTotalKg: string | null;
  pesoBrutoTotalKg: string | null;
  percentualDescontoSolicitado: string | null;
  formaPagamento: FormaPagamentoResumoPedidoDto | null;
  condicaoPagamento: CondicaoPagamentoResumoPedidoDto | null;
  codigoTabelaPreco: string | null;
  contato: ContatoClientePedidoDto | null;
  vendedorResponsavel: { id: string; nome: string | null } | null;
  horarioEnvio: string | null;
  observacoes: string | null;
  notasFiscais: NotaFiscalResumoPedidoDto[];
}
