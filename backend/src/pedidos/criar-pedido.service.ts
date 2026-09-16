import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutoCalculoService } from '../produtos/produto-calculo.service';
import type { ResultadoCalculoQuantidade } from '../produtos/domain/calculo-quantidade-pedido';
import { SolicitacoesDescontoService } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import { ConfiguracaoTabelaPrecoService } from '../tabelas-preco/configuracao-tabela-preco.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';
import { PedidoErpClientService } from './pedido-erp-client.service';
import type { PedidoErpParcelaInput } from './pedido-erp-client.service';

export interface CriarPedidoItemInput {
  produtoId: string;
  metrosDesejados: number;
}

export interface CriarPedidoInput {
  clienteId: string;
  percentualDesconto: number;
  formaPagamentoId: string;
  condicaoPagamentoId: string;
  itens: CriarPedidoItemInput[];
}

export interface CriarPedidoResultadoDto {
  status: 'ENVIADO' | 'AGUARDANDO_APROVACAO';
  pedidoId: string;
  valorTotal: number;
  idExternoErp: string | null;
  solicitacaoDescontoId: string | null;
}

interface ItemCalculado extends ResultadoCalculoQuantidade {
  produtoId: string;
}

// Peso total do pedido (OS-novas-implementacoes.md Bloco 3) - null quando
// QUALQUER item tem produto sem peso cadastrado (nunca expor um total
// parcial como se fosse completo). Liquido e bruto calculados de forma
// independente - um pode faltar sem derrubar o outro.
interface PesoTotalPedido {
  pesoLiquidoTotalKg: number | null;
  pesoBrutoTotalKg: number | null;
}

interface DadosProduto {
  idExternoErp: string;
  pesoLiquidoKg: number | null;
  pesoBrutoKg: number | null;
}

// Orquestra os pedaços já construídos em OS's anteriores (nunca reimplementa
// nenhuma das regras): escopo de cliente por vendedor (OS-BACKEND-23,
// VendedorEscopoService), cálculo por tipo de venda (OS-BACKEND-24,
// ProdutoCalculoService), regra de aprovação de desconto (OS-BACKEND-22,
// SolicitacoesDescontoService). O que é NOVO aqui é só a SEQUÊNCIA: decidir
// se envia ao ERP ou segura pra aprovação, sem nunca deixar um registro
// local "fantasma" pra trás.
//
// Ordem deliberada pra evitar órfão (critério de aceite): quando o desconto
// está dentro do limite, a chamada ao ERP acontece ANTES de qualquer
// escrita local - se falhar, nada nunca foi persistido, não precisa de
// rollback. Só grava o Pedido localmente depois de confirmar sucesso (ou,
// no caminho de aprovação, sem chamar o ERP de jeito nenhum).
@Injectable()
export class CriarPedidoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly produtoCalculoService: ProdutoCalculoService,
    private readonly solicitacoesDescontoService: SolicitacoesDescontoService,
    private readonly pedidoErpClientService: PedidoErpClientService,
    private readonly configuracaoTabelaPrecoService: ConfiguracaoTabelaPrecoService,
  ) {}

  async criar(
    input: CriarPedidoInput,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<CriarPedidoResultadoDto> {
    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
    });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado - não pode criar pedidos',
      );
    }

    const cliente = await this.buscarClienteNoEscopo(input.clienteId, escopo);
    const formaPagamento = await this.buscarFormaPagamento(input.formaPagamentoId);
    const condicaoPagamento = await this.buscarCondicaoPagamento(
      input.condicaoPagamentoId,
    );

    const itensCalculados: ItemCalculado[] = [];
    for (const item of input.itens) {
      const calculo = await this.produtoCalculoService.calcular(
        item.produtoId,
        item.metrosDesejados,
      );
      // ProdutoCalculoService devolve valorFinal (OS-novas-implementacoes.md
      // Bloco 1, ja com desconto POR ITEM opcional aplicado - nao usado
      // aqui, POST /pedidos aplica o desconto uma vez sobre o SUBTOTAL do
      // pedido inteiro, ver mais abaixo) - mapeado pro shape interno
      // ItemCalculado.valorTotal, que o resto deste service ja consome.
      itensCalculados.push({
        produtoId: item.produtoId,
        quantidade: calculo.quantidade,
        unidade: calculo.unidade,
        valorTotal: calculo.valorFinal,
      });
    }

    const subtotal = itensCalculados.reduce(
      (soma, item) => soma + item.valorTotal,
      0,
    );
    const valorComDesconto = arredondarMoeda(
      subtotal * (1 - input.percentualDesconto / 100),
    );
    const produtosPorId = await this.buscarDadosProdutos(itensCalculados);
    const pesoTotal = calcularPesoTotal(itensCalculados, produtosPorId);

    // pedidoId:null - ainda nao criamos o Pedido local (so criamos DEPOIS
    // de decidir o caminho, ver comentario da classe). Se necessitar
    // aprovacao, a SolicitacaoDesconto criada aqui fica com pedidoId nulo
    // temporariamente ate' persistirPedidoAguardandoAprovacao() vincula-la.
    const avaliacao = await this.solicitacoesDescontoService.avaliarDesconto({
      vendedorSolicitanteId: vendedor.id,
      pedidoId: null,
      percentualSolicitado: input.percentualDesconto,
    });

    if (!avaliacao.necessitaAprovacao) {
      const resultadoErp = await this.enviarAoErp(
        cliente,
        vendedor,
        input.percentualDesconto,
        valorComDesconto,
        itensCalculados,
        produtosPorId,
        formaPagamento,
        condicaoPagamento,
      );
      const pedido = await this.persistirPedidoEnviado(
        vendedor.id,
        cliente.id,
        input.percentualDesconto,
        valorComDesconto,
        pesoTotal,
        itensCalculados,
        resultadoErp,
        usuarioId,
        formaPagamento.id,
        condicaoPagamento.id,
      );
      return {
        status: 'ENVIADO',
        pedidoId: pedido.id,
        valorTotal: valorComDesconto,
        idExternoErp: pedido.idExternoErp,
        solicitacaoDescontoId: null,
      };
    }

    const pedido = await this.persistirPedidoAguardandoAprovacao(
      vendedor.id,
      cliente.id,
      input.percentualDesconto,
      valorComDesconto,
      pesoTotal,
      itensCalculados,
      avaliacao.solicitacao.id,
      usuarioId,
      formaPagamento.id,
      condicaoPagamento.id,
    );
    return {
      status: 'AGUARDANDO_APROVACAO',
      pedidoId: pedido.id,
      valorTotal: valorComDesconto,
      idExternoErp: null,
      solicitacaoDescontoId: avaliacao.solicitacao.id,
    };
  }

  // Mesmo criterio de IDOR de OS-BACKEND-23 (ClientesService.buscarPorId):
  // 404 tanto pra "nao existe" quanto pra "existe mas fora do escopo do
  // vendedor logado", nunca 403 - nao confirma existencia pra quem nao
  // deveria ver.
  private async buscarClienteNoEscopo(
    clienteId: string,
    escopo: EscopoClientes,
  ) {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    const cliente = whereEscopo
      ? await this.prisma.cliente.findFirst({
          where: { id: clienteId, ...whereEscopo },
        })
      : null;

    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }
    return cliente;
  }

  // So as ativas (mesmo criterio de PagamentoService.listarFormasPagamento)
  // - nunca deixa criar pedido com uma forma que o Radar ja desativou.
  private async buscarFormaPagamento(formaPagamentoId: string) {
    const forma = await this.prisma.formaPagamento.findUnique({
      where: { id: formaPagamentoId },
    });
    if (!forma || forma.inativa) {
      throw new NotFoundException(
        `Forma de pagamento '${formaPagamentoId}' não encontrada ou inativa`,
      );
    }
    return forma;
  }

  // So as vigentes (mesmo criterio de PagamentoService.listarCondicoesPagamento).
  private async buscarCondicaoPagamento(condicaoPagamentoId: string) {
    const condicao = await this.prisma.condicaoPagamento.findUnique({
      where: { id: condicaoPagamentoId },
    });
    const hoje = new Date();
    if (!condicao || (condicao.validade && condicao.validade < hoje)) {
      throw new NotFoundException(
        `Condição de pagamento '${condicaoPagamentoId}' não encontrada ou expirada`,
      );
    }
    return condicao;
  }

  private async buscarDadosProdutos(
    itens: ItemCalculado[],
  ): Promise<Map<string, DadosProduto>> {
    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: itens.map((item) => item.produtoId) } },
      select: { id: true, idExternoErp: true, pesoLiquidoKg: true, pesoBrutoKg: true },
    });
    return new Map(
      produtos.map((produto) => [
        produto.id,
        {
          idExternoErp: produto.idExternoErp,
          pesoLiquidoKg:
            produto.pesoLiquidoKg != null ? Number(produto.pesoLiquidoKg) : null,
          pesoBrutoKg: produto.pesoBrutoKg != null ? Number(produto.pesoBrutoKg) : null,
        },
      ]),
    );
  }

  // ANTES de qualquer escrita local, de proposito (ver comentario da
  // classe) - se o Radar falhar, nada foi persistido ainda.
  private async enviarAoErp(
    cliente: { idExternoErp: string },
    vendedor: { idExternoErp: string },
    percentualDesconto: number,
    valorComDesconto: number,
    itens: ItemCalculado[],
    produtosPorId: Map<string, DadosProduto>,
    formaPagamento: { idExternoErp: string },
    condicaoPagamento: { idExternoErp: string; parcelas: unknown },
  ) {
    // Tabela GLOBAL selecionada (mesma fonte que ProdutoCalculoService usa
    // hoje pra resolver preco quando nenhum codigoTabela explicito e'
    // passado - CriarPedidoService nunca passa um, ver chamada acima).
    // Sem ela configurada, nao ha idTabelaPreco pra reportar ao Radar -
    // falha aqui, nunca inventa/omite silenciosamente.
    const codigoTabela = await this.configuracaoTabelaPrecoService.obterCodigoSelecionado();
    if (!codigoTabela) {
      throw new UnprocessableEntityException(
        'Nenhuma tabela de preço selecionada globalmente - configure via PATCH /admin/tabelas-preco/configuracao antes de criar um pedido.',
      );
    }
    const tabela = await this.prisma.tabelaPreco.findUnique({
      where: { codigo: codigoTabela },
      select: { idExternoErp: true },
    });
    if (!tabela) {
      throw new UnprocessableEntityException(
        `Tabela de preço '${codigoTabela}' selecionada ainda não foi sincronizada.`,
      );
    }

    const itensErp = itens.map((item) => {
      const produto = produtosPorId.get(item.produtoId);
      if (!produto) {
        throw new UnprocessableEntityException(
          `Produto '${item.produtoId}' não encontrado ao montar o envio ao ERP`,
        );
      }
      return {
        produtoIdExterno: produto.idExternoErp,
        idTabelaPreco: tabela.idExternoErp,
        quantidade: item.quantidade,
        valorUnitario: item.valorTotal / item.quantidade,
      };
    });

    const parcelas = calcularParcelas(
      condicaoPagamento.parcelas,
      valorComDesconto,
      formaPagamento.idExternoErp,
    );

    try {
      return await this.pedidoErpClientService.criar({
        clienteIdExterno: cliente.idExternoErp,
        vendedorIdExterno: vendedor.idExternoErp,
        idCondicaoPagamento: condicaoPagamento.idExternoErp,
        percentualDesconto,
        itens: itensErp,
        parcelas,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error
          ? error.message
          : 'Falha ao enviar pedido ao WK Radar',
      );
    }
  }

  private async persistirPedidoEnviado(
    vendedorId: string,
    clienteId: string,
    percentualDescontoSolicitado: number,
    valorTotal: number,
    pesoTotal: PesoTotalPedido,
    itens: ItemCalculado[],
    resultadoErp: { idExterno: string; codigoIntegrador: string },
    usuarioId: string,
    formaPagamentoId: string,
    condicaoPagamentoId: string,
  ) {
    const sincronizadoEm = new Date();
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          idExternoErp: resultadoErp.idExterno,
          codigoIntegrador: resultadoErp.codigoIntegrador,
          clienteId,
          vendedorId,
          percentualDescontoSolicitado,
          valorTotal,
          pesoLiquidoTotalKg: pesoTotal.pesoLiquidoTotalKg,
          pesoBrutoTotalKg: pesoTotal.pesoBrutoTotalKg,
          formaPagamentoId,
          condicaoPagamentoId,
          statusLocal: 'ENVIADO',
          incompleto: false,
          sincronizadoEm,
        },
      });
      await criarItensPedido(tx, pedido.id, itens, sincronizadoEm);
      // Historico (OS-BACKEND-33) - criacao conta como a primeira transicao
      // do pedido (statusAnterior: null).
      await tx.pedidoHistoricoStatus.create({
        data: {
          pedidoId: pedido.id,
          statusAnterior: null,
          statusNovo: 'ENVIADO',
          alteradoPor: usuarioId,
        },
      });
      return pedido;
    });
  }

  private async persistirPedidoAguardandoAprovacao(
    vendedorId: string,
    clienteId: string,
    percentualDescontoSolicitado: number,
    valorTotal: number,
    pesoTotal: PesoTotalPedido,
    itens: ItemCalculado[],
    solicitacaoDescontoId: string,
    usuarioId: string,
    formaPagamentoId: string,
    condicaoPagamentoId: string,
  ) {
    const sincronizadoEm = new Date();
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          clienteId,
          vendedorId,
          percentualDescontoSolicitado,
          valorTotal,
          pesoLiquidoTotalKg: pesoTotal.pesoLiquidoTotalKg,
          pesoBrutoTotalKg: pesoTotal.pesoBrutoTotalKg,
          formaPagamentoId,
          condicaoPagamentoId,
          statusLocal: 'AGUARDANDO_APROVACAO',
          incompleto: false,
          sincronizadoEm,
        },
      });
      await criarItensPedido(tx, pedido.id, itens, sincronizadoEm);
      await tx.solicitacaoDesconto.update({
        where: { id: solicitacaoDescontoId },
        data: { pedidoId: pedido.id },
      });
      await tx.pedidoHistoricoStatus.create({
        data: {
          pedidoId: pedido.id,
          statusAnterior: null,
          statusNovo: 'AGUARDANDO_APROVACAO',
          alteradoPor: usuarioId,
        },
      });
      return pedido;
    });
  }
}

// Tipo do client de transacao do Prisma (this.prisma.$transaction(tx => ...))
type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

async function criarItensPedido(
  tx: PrismaTx,
  pedidoId: string,
  itens: ItemCalculado[],
  sincronizadoEm: Date,
): Promise<void> {
  await tx.pedidoItem.createMany({
    data: itens.map((item, indice) => ({
      pedidoId,
      numero: indice + 1,
      produtoId: item.produtoId,
      quantidadeVenda: item.quantidade,
      valorTotal: item.valorTotal,
      sincronizadoEm,
    })),
  });
}

// OS-novas-implementacoes.md Bloco 3 - soma peso por item
// (Produto.pesoLiquidoKg/pesoBrutoKg * quantidade calculada, NAO os
// metros pedidos - decisao confirmada com o usuario: peso e' da
// peca/unidade de venda, nao uma taxa por metro). null quando QUALQUER
// item tem produto sem peso cadastrado.
function calcularPesoTotal(
  itens: ItemCalculado[],
  produtosPorId: Map<string, DadosProduto>,
): PesoTotalPedido {
  let somaLiquido = 0;
  let somaBruto = 0;
  let liquidoCompleto = true;
  let brutoCompleto = true;

  for (const item of itens) {
    const produto = produtosPorId.get(item.produtoId);
    if (produto?.pesoLiquidoKg != null) {
      somaLiquido += produto.pesoLiquidoKg * item.quantidade;
    } else {
      liquidoCompleto = false;
    }
    if (produto?.pesoBrutoKg != null) {
      somaBruto += produto.pesoBrutoKg * item.quantidade;
    } else {
      brutoCompleto = false;
    }
  }

  return {
    pesoLiquidoTotalKg: liquidoCompleto ? arredondarPeso(somaLiquido) : null,
    pesoBrutoTotalKg: brutoCompleto ? arredondarPeso(somaBruto) : null,
  };
}

// Parcelas do envio ao ERP derivadas do TEMPLATE ja sincronizado da
// condicao de pagamento escolhida (CondicaoPagamento.parcelas, ver
// condicao-pagamento.sync.ts) - nunca inventadas aqui: cada parcela do
// template vira uma parcela real, com valor = percentual do template
// sobre o valor COM desconto do pedido, vencendo `prazo` dias a partir de
// hoje.
function calcularParcelas(
  parcelasTemplate: unknown,
  valorComDesconto: number,
  idFormaPagamentoExterno: string,
): PedidoErpParcelaInput[] {
  const template = (parcelasTemplate ?? []) as { percentual: number; prazo: number }[];
  const hoje = new Date();
  return template.map((parcela) => ({
    idFormaPagamento: idFormaPagamentoExterno,
    dataVencimento: adicionarDias(hoje, parcela.prazo),
    valor: arredondarMoeda(valorComDesconto * (parcela.percentual / 100)),
  }));
}

function adicionarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function arredondarPeso(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}
