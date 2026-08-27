import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutoCalculoService } from '../produtos/produto-calculo.service';
import type { ResultadoCalculoQuantidade } from '../produtos/domain/calculo-quantidade-pedido';
import { SolicitacoesDescontoService } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';
import { PedidoErpClientService } from './pedido-erp-client.service';

export interface CriarPedidoItemInput {
  produtoId: string;
  metrosDesejados: number;
}

export interface CriarPedidoInput {
  clienteId: string;
  percentualDesconto: number;
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

    const itensCalculados: ItemCalculado[] = [];
    for (const item of input.itens) {
      const calculo = await this.produtoCalculoService.calcular(
        item.produtoId,
        item.metrosDesejados,
      );
      itensCalculados.push({ produtoId: item.produtoId, ...calculo });
    }

    const subtotal = itensCalculados.reduce(
      (soma, item) => soma + item.valorTotal,
      0,
    );
    const valorComDesconto = arredondarMoeda(
      subtotal * (1 - input.percentualDesconto / 100),
    );

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
        vendedor.id,
        cliente.id,
        input.percentualDesconto,
        itensCalculados,
      );
      const pedido = await this.persistirPedidoEnviado(
        vendedor.id,
        cliente.id,
        input.percentualDesconto,
        valorComDesconto,
        itensCalculados,
        resultadoErp,
        usuarioId,
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
      itensCalculados,
      avaliacao.solicitacao.id,
      usuarioId,
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

  // ANTES de qualquer escrita local, de proposito (ver comentario da
  // classe) - se o Radar falhar, nada foi persistido ainda.
  private async enviarAoErp(
    vendedorId: string,
    clienteId: string,
    percentualDesconto: number,
    itens: ItemCalculado[],
  ) {
    try {
      return await this.pedidoErpClientService.criar({
        clienteId,
        vendedorId,
        percentualDesconto,
        itens: itens.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          valorUnitario: item.valorTotal / item.quantidade,
        })),
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
    itens: ItemCalculado[],
    resultadoErp: { idExterno: string; codigoIntegrador: string },
    usuarioId: string,
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
    itens: ItemCalculado[],
    solicitacaoDescontoId: string,
    usuarioId: string,
  ) {
    const sincronizadoEm = new Date();
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          clienteId,
          vendedorId,
          percentualDescontoSolicitado,
          valorTotal,
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

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
