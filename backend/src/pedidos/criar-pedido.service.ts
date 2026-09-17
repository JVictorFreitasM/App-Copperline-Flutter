import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutoCalculoService } from '../produtos/produto-calculo.service';
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
  percentualDesconto: number;
  observacoes?: string;
}

export interface CriarPedidoInput {
  clienteId: string;
  formaPagamentoId: string;
  condicaoPagamentoId: string;
  codigoTabelaPreco?: string;
  contatoId?: string;
  vendedorId?: string;
  itens: CriarPedidoItemInput[];
}

export interface CriarPedidoResultadoDto {
  status: 'ENVIADO' | 'AGUARDANDO_APROVACAO';
  pedidoId: string;
  valorTotal: number;
  idExternoErp: string | null;
  solicitacaoDescontoId: string | null;
}

// Desconto agora e' POR ITEM (OS-pendentes-claude-code.md) - cada item
// carrega seu proprio percentualDesconto/valorUnitarioBruto/valorTotal
// (ja com desconto aplicado, via ProdutoCalculoService.calcular).
interface ItemCalculado {
  produtoId: string;
  quantidade: number;
  unidade: string;
  valorUnitarioBruto: number;
  valorTotal: number;
  percentualDesconto: number;
  observacoes?: string;
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

interface VendedorAlvo {
  id: string;
  idExternoErp: string;
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
    const vendedorAlvo = await this.resolverVendedorAlvo(
      input.vendedorId,
      usuarioId,
      escopo,
    );

    const cliente = await this.buscarClienteNoEscopo(input.clienteId, escopo);
    const formaPagamento = await this.buscarFormaPagamento(input.formaPagamentoId);
    const condicaoPagamento = await this.buscarCondicaoPagamento(
      input.condicaoPagamentoId,
    );
    const contatoId = input.contatoId
      ? (await this.buscarContatoDoCliente(input.contatoId, cliente.id)).id
      : null;

    const itensCalculados: ItemCalculado[] = [];
    for (const item of input.itens) {
      const calculo = await this.produtoCalculoService.calcular(
        item.produtoId,
        item.metrosDesejados,
        {
          codigoTabela: input.codigoTabelaPreco,
          percentualDesconto: item.percentualDesconto,
        },
      );
      itensCalculados.push({
        produtoId: item.produtoId,
        quantidade: calculo.quantidade,
        unidade: calculo.unidade,
        valorUnitarioBruto: calculo.valorUnitario,
        valorTotal: calculo.valorFinal,
        percentualDesconto: item.percentualDesconto,
        observacoes: item.observacoes,
      });
    }

    const valorComDesconto = arredondarMoeda(
      itensCalculados.reduce((soma, item) => soma + item.valorTotal, 0),
    );
    const produtosPorId = await this.buscarDadosProdutos(itensCalculados);
    const pesoTotal = calcularPesoTotal(itensCalculados, produtosPorId);

    // Gate de aprovacao continua 1 por PEDIDO (nao por item) - decisao
    // confirmada com o usuario: o MAIOR desconto entre os itens decide se
    // o pedido inteiro precisa de aprovacao. pedidoId:null - ainda nao
    // criamos o Pedido local (so criamos DEPOIS de decidir o caminho, ver
    // comentario da classe).
    const maiorPercentualDesconto = Math.max(
      ...itensCalculados.map((item) => item.percentualDesconto),
    );
    const avaliacao = await this.solicitacoesDescontoService.avaliarDesconto({
      vendedorSolicitanteId: vendedorAlvo.id,
      pedidoId: null,
      percentualSolicitado: maiorPercentualDesconto,
    });

    if (!avaliacao.necessitaAprovacao) {
      const resultadoErp = await this.enviarAoErp(
        cliente,
        vendedorAlvo,
        input.codigoTabelaPreco,
        valorComDesconto,
        itensCalculados,
        produtosPorId,
        formaPagamento,
        condicaoPagamento,
      );
      const pedido = await this.persistirPedidoEnviado(
        vendedorAlvo.id,
        cliente.id,
        maiorPercentualDesconto,
        valorComDesconto,
        pesoTotal,
        itensCalculados,
        resultadoErp,
        usuarioId,
        formaPagamento.id,
        condicaoPagamento.id,
        input.codigoTabelaPreco ?? null,
        contatoId,
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
      vendedorAlvo.id,
      cliente.id,
      maiorPercentualDesconto,
      valorComDesconto,
      pesoTotal,
      itensCalculados,
      avaliacao.solicitacao.id,
      usuarioId,
      formaPagamento.id,
      condicaoPagamento.id,
      input.codigoTabelaPreco ?? null,
      contatoId,
    );
    return {
      status: 'AGUARDANDO_APROVACAO',
      pedidoId: pedido.id,
      valorTotal: valorComDesconto,
      idExternoErp: null,
      solicitacaoDescontoId: avaliacao.solicitacao.id,
    };
  }

  // Resolve em nome de qual vendedor o pedido e' criado. Sem override
  // (vendedorId): precisa ser o proprio usuario cadastrado como vendedor
  // (comportamento de sempre). Com override: so' aceito quando o usuario
  // logado tem escopo de EQUIPE (supervisor/gerente) e o alvo esta' dentro
  // dela, OU quando e' admin (escopo TODOS) - nunca confia no vendedorId
  // do DTO sem checar contra o escopo resolvido pelo backend (mesmo
  // criterio anti-IDOR do resto do modulo).
  private async resolverVendedorAlvo(
    vendedorId: string | undefined,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<VendedorAlvo> {
    if (!vendedorId) {
      const vendedor = await this.prisma.vendedor.findFirst({
        where: { usuarioId },
        select: { id: true, idExternoErp: true },
      });
      if (!vendedor) {
        throw new ForbiddenException(
          'Usuário autenticado não é um vendedor cadastrado - especifique vendedorId ou cadastre-se como vendedor',
        );
      }
      return vendedor;
    }

    const autorizado =
      escopo.tipo === 'TODOS' ||
      (escopo.tipo === 'EQUIPE' && escopo.vendedorIds.includes(vendedorId));
    if (!autorizado) {
      throw new ForbiddenException(
        'Vendedor informado está fora da sua equipe - não é possível criar pedido em nome dele',
      );
    }

    const vendedor = await this.prisma.vendedor.findUnique({
      where: { id: vendedorId },
      select: { id: true, idExternoErp: true, inativo: true },
    });
    if (!vendedor || vendedor.inativo) {
      throw new NotFoundException(`Vendedor '${vendedorId}' não encontrado ou inativo`);
    }
    return vendedor;
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

  // Mesmo criterio IDOR do resto do modulo - contato precisa pertencer AO
  // cliente do pedido, nunca so' existir em algum lugar do banco.
  private async buscarContatoDoCliente(contatoId: string, clienteId: string) {
    const contato = await this.prisma.contatoCliente.findFirst({
      where: { id: contatoId, clienteId },
      select: { id: true },
    });
    if (!contato) {
      throw new NotFoundException(
        `Contato '${contatoId}' não encontrado para este cliente`,
      );
    }
    return contato;
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
    vendedor: VendedorAlvo,
    codigoTabelaPreco: string | undefined,
    valorComDesconto: number,
    itens: ItemCalculado[],
    produtosPorId: Map<string, DadosProduto>,
    formaPagamento: { idExternoErp: string },
    condicaoPagamento: { idExternoErp: string; parcelas: unknown },
  ) {
    // Tabela escolhida no popup (input.codigoTabelaPreco) com fallback pro
    // singleton GLOBAL de sempre (ConfiguracaoTabelaPrecoService) quando
    // nao informada - mesmo comportamento de antes desta OS pra quem ainda
    // nao manda o campo. Sem nenhuma delas configurada, nao ha
    // idTabelaPreco pra reportar ao Radar - falha aqui, nunca
    // inventa/omite silenciosamente.
    const codigoTabela =
      codigoTabelaPreco ?? (await this.configuracaoTabelaPrecoService.obterCodigoSelecionado());
    if (!codigoTabela) {
      throw new UnprocessableEntityException(
        'Nenhuma tabela de preço selecionada globalmente - configure via PATCH /admin/tabelas-preco/configuracao antes de criar um pedido.',
      );
    }
    const tabela = await this.prisma.tabelaPreco.findUnique({
      where: { codigo: codigoTabela },
      select: { idVendaProdutoExterno: true },
    });
    // idVendaProdutoExterno (REST, namespace DIFERENTE de idExternoErp que
    // e' do SOAP - achado em 2026-09-17, ver comentario no schema.prisma)
    // - e' o que POST /comercial/v1/pedido realmente espera em
    // itens[].idTabelaPreco. Falha aqui em vez de mandar idExternoErp por
    // engano: o Radar ja rejeitou um pedido de teste com "Id invalido"
    // quando isso aconteceu.
    if (!tabela?.idVendaProdutoExterno) {
      throw new UnprocessableEntityException(
        `Tabela de preço '${codigoTabela}' selecionada ainda não tem o ID de venda (REST) sincronizado - rode a sincronização de tabela de preço novamente.`,
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
        idTabelaPreco: tabela.idVendaProdutoExterno as string,
        quantidade: item.quantidade,
        // SEM desconto (preco de tabela puro) - ver comentario abaixo
        // sobre o percentual blendado.
        valorUnitario: item.valorUnitarioBruto,
      };
    });

    // Desconto agora e' POR ITEM do lado de ca, mas o schema real do WK
    // Radar pra desconto por item nunca foi confirmado (POST
    // /comercial/v1/pedido so' tem `total.percentualDescontoProdutos`,
    // aplicado uma vez sobre o pedido inteiro) - por isso continuamos
    // mandando um percentual UNICO "blendado", reconstruido a partir da
    // soma dos itens com desconto, em vez de inventar um campo por item no
    // payload. Limitacao conhecida: o Radar nao sabe que o desconto variou
    // por produto, so' o total final bate. Revisitar se confirmar suporte
    // real do Radar a desconto por item.
    const subtotalBruto = itens.reduce(
      (soma, item) => soma + item.valorUnitarioBruto * item.quantidade,
      0,
    );
    const percentualBlendado =
      subtotalBruto > 0
        ? arredondarMoeda((1 - valorComDesconto / subtotalBruto) * 100)
        : 0;

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
        percentualDesconto: percentualBlendado,
        itens: itensErp,
        parcelas,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `Falha ao enviar pedido ao WK Radar: ${extrairMensagemErroErp(error)}`,
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
    codigoTabelaPreco: string | null,
    contatoId: string | null,
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
          codigoTabelaPreco,
          contatoId,
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
    codigoTabelaPreco: string | null,
    contatoId: string | null,
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
          codigoTabelaPreco,
          contatoId,
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
      valorUnitario: item.quantidade > 0 ? item.valorTotal / item.quantidade : 0,
      valorUnitarioBruto: item.valorUnitarioBruto,
      valorTotal: item.valorTotal,
      percentualDesconto: item.percentualDesconto,
      observacoes: item.observacoes ?? null,
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

// Sem isso, o catch de enviarAoErp so tinha `error.message` do Axios (ex:
// "Request failed with status code 400") - generico, esconde a razao real
// da rejeicao do Radar (que vem no corpo da resposta, `error.response.data`
// - normalmente {message: "..."} ou {errors: [...]}, formato nao
// documentado no swagger). Confirmado em producao (2026-09-17): usuario via
// so "Request failed with status code 400" na tela, sem pista do motivo.
function extrairMensagemErroErp(error: unknown): string {
  if (error instanceof AxiosError) {
    const corpo = error.response?.data as
      | { message?: string; errors?: unknown }
      | undefined;
    if (corpo?.message) return corpo.message;
    if (corpo?.errors) return JSON.stringify(corpo.errors);
    if (corpo) return JSON.stringify(corpo);
    return error.message;
  }
  return error instanceof Error ? error.message : 'erro desconhecido';
}
