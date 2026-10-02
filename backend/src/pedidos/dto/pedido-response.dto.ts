import type {
  Cliente,
  CondicaoPagamento,
  ContatoCliente,
  FormaPagamento,
  NotaFiscal,
  NotaFiscalPedido,
  Pedido,
  PedidoHistoricoStatus,
  PedidoItem,
  Produto,
  Usuario,
  Vendedor,
} from '../../../generated/prisma/client';

export interface ClienteResumoPedidoDto {
  id: string;
  razaoSocial: string | null;
}

export interface VendedorResumoPedidoDto {
  id: string;
  nome: string | null;
  // email ja vem do WK Radar; whatsapp e' cadastro manual do admin (ver
  // AdminVendedoresController) - os dois so pro bloco "Vendedor(a)" do PDF
  // de impressao do pedido (PedidoPdfService), nao usados em outro lugar
  // da tela de detalhe ainda.
  email: string | null;
  whatsapp: string | null;
}

// Resumo de listagem - sem os itens (arvore de pedido pode ser grande, ver
// criterio de aceite da OS 11 sobre nao vazar dado irrelevante numa lista).
export interface PedidoResumoDto {
  id: string;
  idExternoErp: string | null;
  numero: string | null;
  situacao: string | null;
  dataHoraUltimaAlteracao: Date | null;
  // Tela de listagem web (layout de referencia) - "Data de Criacao" (Radar
  // dataEmissao, ver pedido.sync.ts). Null pra pedido criado localmente
  // (nao vem do Radar).
  dataEmissao: Date | null;
  // "Localizacao" (filtro) - UF derivada do endereco de entrega, so ~7%
  // dos pedidos tem esse dado no Radar (ver Pedido.ufEntrega).
  ufEntrega: string | null;
  valorTotal: string | null;
  incompleto: boolean;
  sincronizadoEm: Date;
  cliente: ClienteResumoPedidoDto | null;
  // Vendedor DO PEDIDO sincronizado (Radar `vendedores[0]`), nao quem
  // criou localmente - ver comentario em Pedido.vendedorRadarId
  // (schema.prisma). Null quando o Radar nao informa ou o vendedor
  // referenciado ainda nao foi sincronizado.
  vendedor: VendedorResumoPedidoDto | null;
  // true quando existe SolicitacaoDesconto PENDENTE pra este pedido -
  // icone de exclamacao no layout de referencia (confirmado com o
  // usuario: "aguardando aprovacao de desconto").
  temSolicitacaoDescontoPendente: boolean;
  // Mesmo bucket usado nos atalhos/filtro da listagem (ver
  // ListarPedidosQueryDto.statusAprovacao) e agora tambem exibido na tela
  // de detalhe ("Status da aprovacao", layout de referencia ref1.jpeg) -
  // computado aqui em vez de expor statusLocal cru, pra centralizar a
  // classificacao num so lugar (ver calcularStatusAprovacaoPedido abaixo).
  statusAprovacaoBucket: StatusAprovacaoPedido;
}

export type StatusAprovacaoPedido =
  | 'NAO_INTEGRADO'
  | 'AGUARDANDO_APROVACAO'
  | 'ENVIADO'
  | 'ORCAMENTO'
  | 'CANCELADO';

// Mesma semantica de whereStatusAprovacao em pedidos.service.ts, so que
// classificando um registro ja carregado em vez de filtrar no banco - as
// duas fica com a MESMA prioridade (ORCAMENTO > AGUARDANDO_APROVACAO >
// NAO_INTEGRADO) - um orcamento (Epico 4) tambem tem idExternoErp null,
// mas statusLocal=ORCAMENTO e' o mais especifico, checado primeiro.
export function calcularStatusAprovacaoPedido(pedido: {
  idExternoErp: string | null;
  statusLocal: string | null;
}): StatusAprovacaoPedido {
  if (pedido.statusLocal === 'ORCAMENTO') {
    return 'ORCAMENTO';
  }
  if (pedido.statusLocal === 'CANCELADO') {
    return 'CANCELADO';
  }
  if (pedido.statusLocal === 'AGUARDANDO_APROVACAO') {
    return 'AGUARDANDO_APROVACAO';
  }
  if (pedido.statusLocal === 'ENVIADO' || pedido.idExternoErp !== null) {
    return 'ENVIADO';
  }
  return 'NAO_INTEGRADO';
}

export interface ProdutoResumoPedidoDto {
  id: string;
  nome: string | null;
  codigo: string | null;
  // Peso da PECA (nao multiplicado pela quantidade) - mesmos campos usados
  // pra calcular Pedido.pesoLiquidoTotalKg/pesoBrutoTotalKg (ver
  // CriarPedidoService) - a tela de detalhe multiplica pela quantidade do
  // item pra mostrar o peso daquela linha (layout de referencia ref1.jpeg).
  pesoLiquidoKg: string | null;
  pesoBrutoKg: string | null;
}

// Revisao por item (tela de detalhe do pedido, layout de referencia
// ref1.jpeg) - ver comentario do enum StatusAprovacaoItemPedido no
// schema.prisma pra distincao com SolicitacaoDesconto.
export interface PedidoItemDto {
  id: string;
  numero: number;
  idItemGrade1: string | null;
  idItemGrade2: string | null;
  idItemGrade3: string | null;
  quantidadeVenda: string | null;
  valorUnitario: string | null;
  valorTotal: string | null;
  // Desconto do ITEM (%) - o aprovador decide item por item e precisa ver
  // quanto cada um pediu. null pra item sincronizado do Radar.
  percentualDesconto: string | null;
  situacao: string | null;
  produto: ProdutoResumoPedidoDto | null;
  statusAprovacao: string;
  decididoPor: { id: string; nome: string } | null;
  decididoEm: Date | null;
  // 'METRO' (quantidadeVenda em KM) | 'PECA' (contagem) | null pra item
  // sincronizado do Radar (nunca passa por CriarPedidoService, ver
  // PedidoItem.unidade no schema).
  unidade: string | null;
  // So' preenchido pra item criado localmente (CriarPedidoService) - null
  // pra item sincronizado do Radar. Existia no schema/service desde
  // OS-pendentes-claude-code.md mas nunca tinha sido exposto aqui (bug:
  // gravado no Postgres, nunca voltava no GET).
  observacoes: string | null;
}

export interface ContatoClientePedidoDto {
  id: string;
  nome: string | null;
  telefoneDdd: string | null;
  telefoneNumero: string | null;
}

// Cliente mais completo que ClienteResumoPedidoDto (usado na listagem) -
// so na tela de detalhe (layout de referencia ref1.jpeg), que mostra
// endereco/contato/documento. `enderecos` fica com o mesmo shape solto do
// GET /clientes/:id (ver ClienteDetalheDto em clientes/dto) - array de
// WkRadarEndereco, sem tipagem forte aqui (json puro vindo do Prisma).
export interface ClienteDetalhePedidoDto extends ClienteResumoPedidoDto {
  nomeFantasia: string | null;
  cpfCnpj: string | null;
  // inscricoesLegais.inscricaoEstadual no WK Radar (ver cliente.sync.ts) -
  // so pro bloco de identificacao do PDF de impressao do pedido.
  inscricaoEstadual: string | null;
  codigoIntegrador: string | null;
  enderecos: unknown;
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

// Notas fiscais vinculadas ao pedido (N:N via NotaFiscalPedido) - um
// pedido FATURADO/PARCIALMENTE_FATURADO pode ter mais de uma (faturamento
// parcial, ver comentario em PEDIDO_DETALHE_INCLUDE). `chave` exposto so
// pra o front decidir se mostra o link de PDF sem precisar tentar a
// chamada primeiro (null = nota sem NF-e sincronizada, ex: so NFS-e - fora
// de escopo, ver resolverCaminhoPdfNotaFiscal) - nunca usado pra montar o
// caminho do arquivo no front, isso e' sempre resolvido no backend.
export interface NotaFiscalResumoPedidoDto {
  id: string;
  numero: number | null;
  serie: string | null;
  chave: string | null;
  dataEmissao: Date | null;
  statusNfe: string | null;
  valorTotalNotaFiscal: string | null;
}

// Solicitacao de desconto acima da alcada do vendedor vinculada ao pedido
// (a mais recente) - null quando o pedido nunca precisou de aprovacao. Os
// botoes de aceitar/recusar so aparecem quando isso existe.
export interface SolicitacaoDescontoDoPedidoDto {
  id: string;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  percentualSolicitado: number;
  papelExigido: 'VENDEDOR' | 'SUPERVISOR' | 'GERENTE';
  aprovadorEsperadoNome: string | null;
  // true so quando o usuario logado pode decidir AGORA (pendente, nao e o
  // proprio solicitante, papel suficiente) - decisao de verdade segue
  // validada no backend em SolicitacoesDescontoService.decidir.
  podeDecidir: boolean;
}

export interface PedidoDetalheDto extends Omit<PedidoResumoDto, 'cliente'> {
  cliente: ClienteDetalhePedidoDto | null;
  solicitacaoDesconto: SolicitacaoDescontoDoPedidoDto | null;
  itens: PedidoItemDto[];
  // Peso total do pedido (OS-novas-implementacoes.md Bloco 3) - null pra
  // pedido sincronizado do ERP (nunca calculado nesse caminho) ou quando
  // algum item tem produto sem peso cadastrado.
  pesoLiquidoTotalKg: string | null;
  pesoBrutoTotalKg: string | null;
  // "Pagamento" (layout de referencia ref1.jpeg, bloco De/Por + %desconto)
  // - so' existe pra pedido criado LOCALMENTE (POST /pedidos, ver
  // CriarPedidoService) - pedido sincronizado do Radar nao tem esse valor
  // no nosso banco (Radar nao expoe desconto/forma/condicao de pagamento
  // mapeados, ver OS-pendentes-claude-code.md).
  percentualDescontoSolicitado: string | null;
  // Escolhidos na criacao (POST /pedidos, ver CriarPedidoDto) - null pra
  // pedido sincronizado do Radar (mesmo criterio de
  // percentualDescontoSolicitado acima).
  formaPagamento: FormaPagamentoResumoPedidoDto | null;
  condicaoPagamento: CondicaoPagamentoResumoPedidoDto | null;
  codigoTabelaPreco: string | null;
  contato: ContatoClientePedidoDto | null;
  // Quem o pedido PERTENCE (Pedido.vendedorId - pode ser diferente de quem
  // criou, quando supervisor/gerencia cria em nome de alguem da equipe -
  // ver CriarPedidoService.resolverVendedorAlvo) - DIFERENTE do campo
  // `vendedor` herdado de PedidoResumoDto (esse e' o vendedor do Radar,
  // so' preenchido em pedido SINCRONIZADO). So' um dos dois fica
  // preenchido por vez, conforme a origem do pedido.
  vendedorResponsavel: VendedorResumoPedidoDto | null;
  // "Horario do envio" - timestamp real da transicao pra ENVIADO em
  // PedidoHistoricoStatus (ver comentario em PEDIDO_DETALHE_INCLUDE). null
  // pra pedido sincronizado do Radar ou ainda AGUARDANDO_APROVACAO.
  horarioEnvio: Date | null;
  // Observacoes do pedido (2026-09-21) - null pra pedido sincronizado do
  // Radar (nao expoe observacao livre, ver Pedido.observacoes no schema).
  observacoes: string | null;
  // Notas fiscais vinculadas (ver NotaFiscalResumoPedidoDto acima) -
  // ordenadas por dataEmissao (mais antiga primeiro), sempre lista (nunca
  // null) - vazia quando nao ha nenhuma nota vinculada ainda.
  notasFiscais: NotaFiscalResumoPedidoDto[];
}

export function paraClienteResumoPedidoDto(
  cliente: Cliente | null,
): ClienteResumoPedidoDto | null {
  return cliente ? { id: cliente.id, razaoSocial: cliente.razaoSocial } : null;
}

export function paraPedidoResumoDto(
  pedido: Pedido & {
    cliente: Cliente | null;
    vendedorRadar?: Vendedor | null;
    // Vendedor DONO do pedido (Pedido.vendedorId) - so' preenchido de
    // verdade pra pedido criado localmente (POST /pedidos). Fallback pra
    // vendedorRadar abaixo, achado 2026-09-28: sem isso, todo pedido
    // recem-criado (ainda sem retorno do sync) mostrava "—" no nome do
    // vendedor na listagem, mesmo o vendedor sendo conhecido.
    vendedor?: Vendedor | null;
  },
  temSolicitacaoDescontoPendente = false,
): PedidoResumoDto {
  return {
    id: pedido.id,
    idExternoErp: pedido.idExternoErp,
    numero: pedido.numero,
    situacao: pedido.situacao,
    dataHoraUltimaAlteracao: pedido.dataHoraUltimaAlteracao,
    dataEmissao: pedido.dataEmissao,
    ufEntrega: pedido.ufEntrega,
    valorTotal: pedido.valorTotal?.toString() ?? null,
    incompleto: pedido.incompleto,
    sincronizadoEm: pedido.sincronizadoEm,
    cliente: paraClienteResumoPedidoDto(pedido.cliente),
    vendedor: pedido.vendedorRadar
      ? {
          id: pedido.vendedorRadar.id,
          nome: pedido.vendedorRadar.nome,
          email: pedido.vendedorRadar.email,
          whatsapp: pedido.vendedorRadar.whatsapp,
        }
      : pedido.vendedor
        ? {
            id: pedido.vendedor.id,
            nome: pedido.vendedor.nome,
            email: pedido.vendedor.email,
            whatsapp: pedido.vendedor.whatsapp,
          }
        : null,
    temSolicitacaoDescontoPendente,
    statusAprovacaoBucket: calcularStatusAprovacaoPedido(pedido),
  };
}

export function paraClienteDetalhePedidoDto(
  cliente: (Cliente & { contatos: ContatoCliente[] }) | null,
): ClienteDetalhePedidoDto | null {
  if (!cliente) return null;
  return {
    id: cliente.id,
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia,
    cpfCnpj: cliente.cpfCnpj,
    inscricaoEstadual: cliente.inscricaoEstadual,
    codigoIntegrador: cliente.codigoIntegrador,
    enderecos: cliente.enderecos,
    contatos: cliente.contatos.map((contato) => ({
      id: contato.id,
      nome: contato.nome,
      telefoneDdd: contato.telefoneDdd,
      telefoneNumero: contato.telefoneNumero,
    })),
  };
}

function paraPedidoItemDto(
  item: PedidoItem & { produto: Produto | null; decididoPor: Usuario | null },
): PedidoItemDto {
  return {
    id: item.id,
    numero: item.numero,
    idItemGrade1: item.idItemGrade1,
    idItemGrade2: item.idItemGrade2,
    idItemGrade3: item.idItemGrade3,
    quantidadeVenda: item.quantidadeVenda?.toString() ?? null,
    unidade: item.unidade,
    valorUnitario: item.valorUnitario?.toString() ?? null,
    valorTotal: item.valorTotal?.toString() ?? null,
    percentualDesconto: item.percentualDesconto?.toString() ?? null,
    situacao: item.situacao,
    produto: item.produto
      ? {
          id: item.produto.id,
          nome: item.produto.nome,
          codigo: item.produto.codigo,
          pesoLiquidoKg: item.produto.pesoLiquidoKg?.toString() ?? null,
          pesoBrutoKg: item.produto.pesoBrutoKg?.toString() ?? null,
        }
      : null,
    statusAprovacao: item.statusAprovacao,
    decididoPor: item.decididoPor
      ? { id: item.decididoPor.id, nome: item.decididoPor.nome }
      : null,
    decididoEm: item.decididoEm,
    observacoes: item.observacoes,
  };
}

export function paraPedidoDetalheDto(
  pedido: Pedido & {
    cliente: (Cliente & { contatos: ContatoCliente[] }) | null;
    vendedorRadar?: Vendedor | null;
    vendedor?: Vendedor | null;
    formaPagamento?: FormaPagamento | null;
    condicaoPagamento?: CondicaoPagamento | null;
    contato?: ContatoCliente | null;
    historicoStatus?: PedidoHistoricoStatus[];
    itens: (PedidoItem & { produto: Produto | null; decididoPor: Usuario | null })[];
    notasFiscais?: (NotaFiscalPedido & { notaFiscal: NotaFiscal })[];
  },
  temSolicitacaoDescontoPendente = false,
): PedidoDetalheDto {
  return {
    ...paraPedidoResumoDto(pedido, temSolicitacaoDescontoPendente),
    cliente: paraClienteDetalhePedidoDto(pedido.cliente),
    solicitacaoDesconto: null,
    pesoLiquidoTotalKg: pedido.pesoLiquidoTotalKg?.toString() ?? null,
    pesoBrutoTotalKg: pedido.pesoBrutoTotalKg?.toString() ?? null,
    percentualDescontoSolicitado: pedido.percentualDescontoSolicitado?.toString() ?? null,
    horarioEnvio: pedido.historicoStatus?.[0]?.alteradoEm ?? null,
    formaPagamento: pedido.formaPagamento
      ? {
          id: pedido.formaPagamento.id,
          codigo: pedido.formaPagamento.codigo,
          descricao: pedido.formaPagamento.descricao,
        }
      : null,
    condicaoPagamento: pedido.condicaoPagamento
      ? {
          id: pedido.condicaoPagamento.id,
          codigo: pedido.condicaoPagamento.codigo,
          nome: pedido.condicaoPagamento.nome,
        }
      : null,
    codigoTabelaPreco: pedido.codigoTabelaPreco,
    contato: pedido.contato
      ? {
          id: pedido.contato.id,
          nome: pedido.contato.nome,
          telefoneDdd: pedido.contato.telefoneDdd,
          telefoneNumero: pedido.contato.telefoneNumero,
        }
      : null,
    vendedorResponsavel: pedido.vendedor
      ? {
          id: pedido.vendedor.id,
          nome: pedido.vendedor.nome,
          email: pedido.vendedor.email,
          whatsapp: pedido.vendedor.whatsapp,
        }
      : null,
    observacoes: pedido.observacoes,
    itens: pedido.itens.map(paraPedidoItemDto),
    notasFiscais: (pedido.notasFiscais ?? []).map(({ notaFiscal }) => ({
      id: notaFiscal.id,
      numero: notaFiscal.numero,
      serie: notaFiscal.serie,
      chave: notaFiscal.chave,
      dataEmissao: notaFiscal.dataEmissao,
      statusNfe: notaFiscal.statusNfe,
      valorTotalNotaFiscal: notaFiscal.valorTotalNotaFiscal?.toString() ?? null,
    })),
  };
}
