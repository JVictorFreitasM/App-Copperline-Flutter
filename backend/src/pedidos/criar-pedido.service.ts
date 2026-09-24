import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { ConfiguracaoOrcamentoService } from '../configuracoes/configuracao-orcamento.service';
import { ConfiguracaoRastreioService } from '../configuracoes/configuracao-rastreio.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutoCalculoService } from '../produtos/produto-calculo.service';
import { SolicitacoesDescontoService } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import { ConfiguracaoTabelaPrecoService } from '../tabelas-preco/configuracao-tabela-preco.service';
import { calcularDistanciaMetros } from '../visitas/domain/distancia-geografica';
import {
  construirWhereClientePorEscopo,
  construirWherePedidoPorEscopo,
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
  // Opcionais (Epico 4, config-aba-rastreio.jpg - "Distância máxima do
  // cliente para registro de pedido") - so validados quando essa config
  // tem um valor configurado (ver validarDistanciaRegistro()).
  latitude?: number;
  longitude?: number;
  // Epico 4 (config-aba-orcamento.jpg) - salva como rascunho em vez de
  // enviar ao ERP (ver comentario em criar()).
  salvarComoOrcamento?: boolean;
  // Observacoes do PEDIDO inteiro (2026-09-21) - ver CriarPedidoDto.
  observacoes?: string;
  itens: CriarPedidoItemInput[];
}

export interface CriarPedidoResultadoDto {
  status: 'ENVIADO' | 'AGUARDANDO_APROVACAO' | 'ORCAMENTO';
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

const METROS_POR_KM = 1000;

// 2026-09-21 - item.quantidade (ItemCalculado) fica SEMPRE em METROS pra
// item METRO (retalho) - precisa continuar assim porque calcularPesoTotal
// multiplica Produto.pesoLiquidoKg/pesoBrutoKg (kg POR METRO pra produto
// retalho) por esse valor (decisao ja confirmada, ver comentario em
// calcularPesoTotal). MAS a quantidade que o WK Radar espera em
// quantidadeVenda (e que persistimos em PedidoItem.quantidadeVenda) e' em
// KM pra esse mesmo tipo de produto - confirmado cruzando
// itens_tabela_preco.preco com PedidoItem.quantidadeVenda de pedidos REAIS
// ja sincronizados (valores tipo 0.05-2.2, nunca inteiros grandes tipo
// "1000"). Item PECA (rolo/peca fechada) nao converte - quantidade ja e'
// contagem de pecas nos dois sentidos.
function quantidadeVendaExterna(item: ItemCalculado): number {
  return item.unidade === 'METRO' ? item.quantidade / METROS_POR_KM : item.quantidade;
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
    private readonly configuracaoRastreioService: ConfiguracaoRastreioService,
    private readonly configuracaoOrcamentoService: ConfiguracaoOrcamentoService,
  ) {}

  async criar(
    input: CriarPedidoInput,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<CriarPedidoResultadoDto> {
    await this.validarItensSemDuplicata(input.itens);

    const vendedorAlvo = await this.resolverVendedorAlvo(
      input.vendedorId,
      usuarioId,
      escopo,
    );

    const cliente = await this.buscarClienteNoEscopo(input.clienteId, escopo);
    await this.validarDistanciaRegistro(cliente, input.latitude, input.longitude);
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
    // Gate de aprovacao (via avaliarDesconto, mais abaixo) E o rascunho
    // de orcamento (branch logo abaixo) usam o mesmo criterio: o MAIOR
    // desconto entre os itens - decisao confirmada com o usuario.
    const maiorPercentualDesconto = Math.max(
      ...itensCalculados.map((item) => item.percentualDesconto),
    );

    // Orcamento (Epico 4, config-aba-orcamento.jpg) - rascunho local,
    // pula avaliacao de desconto E envio ao ERP por completo; as duas
    // coisas so acontecem quando o orcamento e' "transformado" num
    // pedido de verdade (ver transformarEmPedido() abaixo).
    if (input.salvarComoOrcamento) {
      const configOrcamento = await this.configuracaoOrcamentoService.obter();
      if (!configOrcamento.habilitarCriacaoOrcamento) {
        throw new UnprocessableEntityException(
          'Criação de orçamento está desabilitada - fale com o admin para habilitar em Configurações > Orçamento.',
        );
      }
      const pedido = await this.persistirOrcamento(
        vendedorAlvo.id,
        cliente.id,
        maiorPercentualDesconto,
        valorComDesconto,
        pesoTotal,
        itensCalculados,
        usuarioId,
        formaPagamento.id,
        condicaoPagamento.id,
        input.codigoTabelaPreco ?? null,
        contatoId,
        input.observacoes ?? null,
      );
      return {
        status: 'ORCAMENTO',
        pedidoId: pedido.id,
        valorTotal: valorComDesconto,
        idExternoErp: null,
        solicitacaoDescontoId: null,
      };
    }

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
        input.observacoes ?? null,
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
      input.observacoes ?? null,
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

  // Distância mínima até o pin do cliente (Epico 4, config-aba-rastreio.jpg
  // - "Distância máxima do cliente para registro de pedido") - so' entra
  // em ação quando o admin configurou um valor (null = sem exigência,
  // comportamento de sempre). Mesma lógica de bypass sem GPS de
  // VisitasService.resolverDistancia (permitirRegistroComGpsDesabilitado).
  private async validarDistanciaRegistro(
    cliente: { localizacaoLat: { toNumber(): number } | null; localizacaoLng: { toNumber(): number } | null },
    latitude: number | undefined,
    longitude: number | undefined,
  ): Promise<void> {
    const config = await this.configuracaoRastreioService.obter();
    const distanciaMaxima = config.distanciaMaximaClienteRegistroPedidoMetros;
    if (distanciaMaxima === null) {
      return;
    }

    if (latitude === undefined || longitude === undefined) {
      if (config.permitirRegistroComGpsDesabilitado) {
        return;
      }
      throw new BadRequestException(
        'Localização (GPS) é obrigatória para registrar este pedido - habilite o GPS e tente novamente, ou peça ao admin para permitir registro sem GPS',
      );
    }

    if (cliente.localizacaoLat === null || cliente.localizacaoLng === null) {
      throw new UnprocessableEntityException(
        'Cliente sem localização (pin) definida - não é possível validar a distância exigida para registrar este pedido',
      );
    }

    const distanciaMetros = calcularDistanciaMetros(
      latitude,
      longitude,
      cliente.localizacaoLat.toNumber(),
      cliente.localizacaoLng.toNumber(),
    );
    if (distanciaMetros > distanciaMaxima) {
      throw new BadRequestException(
        `Pedido a ${Math.round(distanciaMetros)}m do cliente - fora do raio máximo de ${distanciaMaxima}m`,
      );
    }
  }

  // Guarda de dados (pedido explicito do usuario, 2026-09-23; configuravel
  // desde 2026-09-24 via ConfiguracaoOrcamento.permitirItensRepetidos, aba
  // "Orcamento" da tela de Configuracoes - default BLOQUEADO, mesmo
  // comportamento de sempre) - o mesmo produto duas vezes no MESMO pedido
  // nao tem leitura de negocio clara (qual dos dois desconto/observacao
  // vale?) e o web ja evita isso na UI por padrao (abre o item existente
  // pra edicao em vez de duplicar) - aqui e' a ultima linha de defesa pra
  // QUALQUER client (mobile, chamada direta a API), rejeitando cedo antes
  // de calcular preco/enviar ao ERP - SE a config nao tiver liberado.
  private async validarItensSemDuplicata(itens: CriarPedidoItemInput[]): Promise<void> {
    const { permitirItensRepetidos } = await this.configuracaoOrcamentoService.obter();
    if (permitirItensRepetidos) {
      return;
    }

    const vistos = new Set<string>();
    for (const item of itens) {
      if (vistos.has(item.produtoId)) {
        throw new BadRequestException(
          `Produto '${item.produtoId}' informado mais de uma vez no mesmo pedido - some as quantidades num único item em vez de repetir o produto.`,
        );
      }
      vistos.add(item.produtoId);
    }
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
        // Em KM pra item METRO (retalho), nao os metros usados
        // internamente - ver comentario de quantidadeVendaExterna.
        quantidade: quantidadeVendaExterna(item),
        // SEM desconto (preco de tabela puro) - ver comentario abaixo
        // sobre o percentual blendado. Arredondado a 2 casas (2026-09-21) -
        // o Radar rejeita ValorUnitario com mais de 2 decimais
        // ("nao permite mais de 2 casas decimais"); precoVenda por metro
        // (ver ProdutoCalculoService.resolverPrecoVenda, preco por KM
        // convertido) pode ter ate 6 casas internamente, mas o payload do
        // ERP precisa da versao arredondada pra moeda.
        valorUnitario: arredondarMoeda(item.valorUnitarioBruto),
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
    observacoes: string | null,
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
          observacoes,
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
    observacoes: string | null,
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
          observacoes,
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

  // Orcamento (Epico 4) - mesma forma de persistirPedidoAguardandoAprovacao,
  // mas sem SolicitacaoDesconto nenhuma vinculada (rascunho ainda nao
  // passou por avaliacao de desconto).
  private async persistirOrcamento(
    vendedorId: string,
    clienteId: string,
    percentualDescontoSolicitado: number,
    valorTotal: number,
    pesoTotal: PesoTotalPedido,
    itens: ItemCalculado[],
    usuarioId: string,
    formaPagamentoId: string,
    condicaoPagamentoId: string,
    codigoTabelaPreco: string | null,
    contatoId: string | null,
    observacoes: string | null,
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
          observacoes,
          statusLocal: 'ORCAMENTO',
          incompleto: false,
          sincronizadoEm,
        },
      });
      await criarItensPedido(tx, pedido.id, itens, sincronizadoEm);
      await tx.pedidoHistoricoStatus.create({
        data: {
          pedidoId: pedido.id,
          statusAnterior: null,
          statusNovo: 'ORCAMENTO',
          alteradoPor: usuarioId,
        },
      });
      return pedido;
    });
  }

  // Transforma um orcamento (rascunho) num pedido de verdade (Epico 4,
  // "Permitir ao Vendedor transformar um Orçamento em Pedido... no
  // Aplicativo Móvel") - so' AGORA avalia desconto e (se aprovado sem
  // necessidade de aprovacao) chama o ERP, exatamente como criar()
  // avalia um pedido novo; reaproveita enviarAoErp() sem duplicar a
  // logica de montagem do payload.
  async transformarEmPedido(
    pedidoId: string,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<CriarPedidoResultadoDto> {
    const configOrcamento = await this.configuracaoOrcamentoService.obter();
    if (!configOrcamento.permitirVendedorTransformarEmPedido) {
      throw new ForbiddenException(
        'Conversão de orçamento em pedido está desabilitada - fale com o admin para habilitar em Configurações > Orçamento.',
      );
    }

    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    const pedido = whereEscopo
      ? await this.prisma.pedido.findFirst({
          where: { id: pedidoId, statusLocal: 'ORCAMENTO', ...whereEscopo },
          include: { itens: true, cliente: true, vendedor: true, formaPagamento: true, condicaoPagamento: true },
        })
      : null;
    if (
      !pedido ||
      !pedido.vendedor ||
      !pedido.cliente ||
      !pedido.formaPagamento ||
      !pedido.condicaoPagamento
    ) {
      throw new NotFoundException(`Orçamento '${pedidoId}' não encontrado`);
    }

    // quantidadeVenda persistido ja' esta' na unidade EXTERNA (KM pra
    // METRO/retalho, ver quantidadeVendaExterna) - reconstroi de volta pra
    // METROS aqui (unidade INTERNA usada por calcularPesoTotal/subtotalBruto
    // dentro de enviarAoErp), usando o `unidade` congelado no item (nao
    // reconsultado do produto - ver comentario no schema.prisma).
    const itensCalculados: ItemCalculado[] = pedido.itens.map((item) => {
      const quantidadeExterna = item.quantidadeVenda?.toNumber() ?? 0;
      const unidade = item.unidade ?? '';
      return {
        produtoId: item.produtoId!,
        quantidade: unidade === 'METRO' ? quantidadeExterna * METROS_POR_KM : quantidadeExterna,
        unidade,
        valorUnitarioBruto: item.valorUnitarioBruto?.toNumber() ?? 0,
        valorTotal: item.valorTotal?.toNumber() ?? 0,
        percentualDesconto: item.percentualDesconto?.toNumber() ?? 0,
        observacoes: item.observacoes ?? undefined,
      };
    });
    const valorComDesconto = arredondarMoeda(
      itensCalculados.reduce((soma, item) => soma + item.valorTotal, 0),
    );
    const produtosPorId = await this.buscarDadosProdutos(itensCalculados);
    const maiorPercentualDesconto = Math.max(
      ...itensCalculados.map((item) => item.percentualDesconto),
    );
    const vendedorAlvo: VendedorAlvo = {
      id: pedido.vendedor.id,
      idExternoErp: pedido.vendedor.idExternoErp,
    };

    // pedidoId JA preenchido (diferente de criar(), onde o Pedido ainda
    // nao existe nesse ponto) - a SolicitacaoDesconto ja nasce vinculada,
    // sem precisar do update de backfill que persistirPedidoAguardandoAprovacao
    // faz pro caminho de criacao nova.
    const avaliacao = await this.solicitacoesDescontoService.avaliarDesconto({
      vendedorSolicitanteId: vendedorAlvo.id,
      pedidoId: pedido.id,
      percentualSolicitado: maiorPercentualDesconto,
    });

    if (!avaliacao.necessitaAprovacao) {
      const resultadoErp = await this.enviarAoErp(
        pedido.cliente,
        vendedorAlvo,
        pedido.codigoTabelaPreco ?? undefined,
        valorComDesconto,
        itensCalculados,
        produtosPorId,
        pedido.formaPagamento,
        pedido.condicaoPagamento,
      );
      const atualizado = await this.prisma.$transaction(async (tx) => {
        const novo = await tx.pedido.update({
          where: { id: pedido.id },
          data: {
            idExternoErp: resultadoErp.idExterno,
            codigoIntegrador: resultadoErp.codigoIntegrador,
            statusLocal: 'ENVIADO',
            sincronizadoEm: new Date(),
          },
        });
        await tx.pedidoHistoricoStatus.create({
          data: {
            pedidoId: pedido.id,
            statusAnterior: 'ORCAMENTO',
            statusNovo: 'ENVIADO',
            alteradoPor: usuarioId,
          },
        });
        return novo;
      });
      return {
        status: 'ENVIADO',
        pedidoId: atualizado.id,
        valorTotal: valorComDesconto,
        idExternoErp: atualizado.idExternoErp,
        solicitacaoDescontoId: null,
      };
    }

    const atualizado = await this.prisma.$transaction(async (tx) => {
      const novo = await tx.pedido.update({
        where: { id: pedido.id },
        data: { statusLocal: 'AGUARDANDO_APROVACAO', sincronizadoEm: new Date() },
      });
      await tx.pedidoHistoricoStatus.create({
        data: {
          pedidoId: pedido.id,
          statusAnterior: 'ORCAMENTO',
          statusNovo: 'AGUARDANDO_APROVACAO',
          alteradoPor: usuarioId,
        },
      });
      return novo;
    });
    return {
      status: 'AGUARDANDO_APROVACAO',
      pedidoId: atualizado.id,
      valorTotal: valorComDesconto,
      idExternoErp: null,
      solicitacaoDescontoId: avaliacao.solicitacao.id,
    };
  }

  // Cancela (apaga) um orcamento (Epico 4, tela-notificacao... texto da
  // OS: "...ou cancelem o orçamento") - nunca chegou no ERP, entao
  // cancelar e' apagar de vez, mesmo espirito de "sem deixar registro
  // orfao" ja usado pro envio que falha (ver comentario da classe).
  // PedidoItem/PedidoHistoricoStatus cascateiam via onDelete: Cascade no
  // schema - so precisa apagar o Pedido.
  async cancelarOrcamento(pedidoId: string, escopo: EscopoClientes): Promise<void> {
    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    const pedido = whereEscopo
      ? await this.prisma.pedido.findFirst({
          where: { id: pedidoId, statusLocal: 'ORCAMENTO', ...whereEscopo },
          select: { id: true },
        })
      : null;
    if (!pedido) {
      throw new NotFoundException(`Orçamento '${pedidoId}' não encontrado`);
    }
    await this.prisma.pedido.delete({ where: { id: pedidoId } });
  }

  // Alteracao de vendedor de um orcamento (Epico 4, "Permitir alteração
  // de vendedor de um orçamento criado") - so' usuario com papel
  // gerencial (escopo EQUIPE/TODOS, mesmo vocabulario do resto do
  // modulo: supervisor/gerente/admin) pode reatribuir, e so' pra um
  // vendedor DENTRO da propria equipe (mesmo criterio anti-IDOR de
  // resolverVendedorAlvo).
  async alterarVendedorOrcamento(
    pedidoId: string,
    novoVendedorId: string,
    escopo: EscopoClientes,
  ): Promise<void> {
    if (escopo.tipo !== 'TODOS' && escopo.tipo !== 'EQUIPE') {
      throw new ForbiddenException(
        'Só um usuário com papel gerencial (supervisor/gerente) pode alterar o vendedor de um orçamento',
      );
    }

    const configOrcamento = await this.configuracaoOrcamentoService.obter();
    if (!configOrcamento.permitirAlteracaoVendedorOrcamentoCriado) {
      throw new ForbiddenException(
        'Alteração de vendedor de orçamento está desabilitada - fale com o admin para habilitar em Configurações > Orçamento.',
      );
    }

    const autorizado = escopo.tipo === 'TODOS' || escopo.vendedorIds.includes(novoVendedorId);
    if (!autorizado) {
      throw new ForbiddenException(
        'Vendedor informado está fora da sua equipe - não é possível reatribuir o orçamento a ele',
      );
    }

    const novoVendedor = await this.prisma.vendedor.findUnique({
      where: { id: novoVendedorId },
      select: { id: true, inativo: true },
    });
    if (!novoVendedor || novoVendedor.inativo) {
      throw new NotFoundException(`Vendedor '${novoVendedorId}' não encontrado ou inativo`);
    }

    const whereEscopo = construirWherePedidoPorEscopo(escopo);
    const pedido = whereEscopo
      ? await this.prisma.pedido.findFirst({
          where: { id: pedidoId, statusLocal: 'ORCAMENTO', ...whereEscopo },
          select: { id: true },
        })
      : null;
    if (!pedido) {
      throw new NotFoundException(`Orçamento '${pedidoId}' não encontrado`);
    }

    await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: { vendedorId: novoVendedorId },
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
      // Em KM pra item METRO (retalho) - ver comentario de
      // quantidadeVendaExterna. valorUnitario abaixo continua dividindo
      // por item.quantidade (metros), NAO pela quantidade convertida -
      // e' o preco liquido POR METRO, mesma unidade de valorUnitarioBruto.
      quantidadeVenda: quantidadeVendaExterna(item),
      valorUnitario: item.quantidade > 0 ? item.valorTotal / item.quantidade : 0,
      valorUnitarioBruto: item.valorUnitarioBruto,
      valorTotal: item.valorTotal,
      percentualDesconto: item.percentualDesconto,
      observacoes: item.observacoes ?? null,
      unidade: item.unidade,
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
