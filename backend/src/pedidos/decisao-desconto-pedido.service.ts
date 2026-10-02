import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SolicitacoesDescontoService } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import type { SolicitacaoDescontoDto } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import {
  construirWherePedidoPorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';
import { CriarPedidoService } from './criar-pedido.service';

export type AcaoDecisaoDesconto = 'aprovar' | 'rejeitar';

export interface ResultadoDecisaoDesconto {
  // true quando esta decisao fechou o pedido (nao sobrou item pendente).
  concluido: boolean;
  resultado: 'ENVIADO' | 'CANCELADO' | null;
}

// Decisao do desconto POR ITEM (pedido do usuario, 2026-10-02): o
// supervisor/gerente aceita ou recusa cada item com desconto acima da
// alcada; o pedido so' segue quando nenhum item ficou pendente - ai segue so'
// com os aceitos, ou e' cancelado se nenhum foi aceito (ver
// CriarPedidoService.concluirPedidoAposDecisao). A autorizacao (papel com
// alcada, nao ser o proprio solicitante) e' toda do backend, via
// SolicitacoesDescontoService.autorizarDecisao - a tela so' esconde botao.
@Injectable()
export class DecisaoDescontoPedidoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly solicitacoesDescontoService: SolicitacoesDescontoService,
    private readonly criarPedidoService: CriarPedidoService,
  ) {}

  // itemIds undefined = todos os itens que ainda estao PENDENTES (botoes
  // "aceitar/recusar todos").
  async decidir(input: {
    pedidoId: string;
    itemIds?: string[];
    acao: AcaoDecisaoDesconto;
    usuarioId: string;
    // undefined = sem recorte de escopo (decisao pela SOLICITACAO, cuja
    // autorizacao e' papel + nao ser o solicitante - mesma regra de sempre).
    escopo?: EscopoClientes;
  }): Promise<ResultadoDecisaoDesconto> {
    const whereEscopo = input.escopo ? construirWherePedidoPorEscopo(input.escopo) : {};
    const pedido = whereEscopo
      ? await this.prisma.pedido.findFirst({
          where: { id: input.pedidoId, ...whereEscopo },
          include: { itens: { select: { id: true, statusAprovacao: true } } },
        })
      : null;
    if (!pedido) {
      throw new NotFoundException(`Pedido '${input.pedidoId}' não encontrado`);
    }
    if (pedido.statusLocal !== 'AGUARDANDO_APROVACAO') {
      throw new ConflictException('Este pedido não está aguardando aprovação de desconto');
    }

    const solicitacao = await this.prisma.solicitacaoDesconto.findFirst({
      where: { pedidoId: pedido.id, status: 'PENDENTE' },
      orderBy: { criadoEm: 'desc' },
      select: { id: true },
    });
    if (!solicitacao) {
      throw new ConflictException('Este pedido não tem solicitação de desconto pendente');
    }

    const { aprovadorVendedor } = await this.solicitacoesDescontoService.autorizarDecisao(
      solicitacao.id,
      input.usuarioId,
    );

    const pendentes = pedido.itens.filter((item) => item.statusAprovacao === 'PENDENTE');
    let alvoIds: string[];
    if (input.itemIds === undefined) {
      alvoIds = pendentes.map((item) => item.id);
    } else {
      alvoIds = [...new Set(input.itemIds)];
      for (const itemId of alvoIds) {
        const item = pedido.itens.find((i) => i.id === itemId);
        if (!item) {
          throw new NotFoundException(`Item '${itemId}' não encontrado no pedido '${pedido.id}'`);
        }
        if (item.statusAprovacao !== 'PENDENTE') {
          throw new ConflictException(
            `O item '${itemId}' não está pendente de decisão (já foi decidido ou não exige aprovação)`,
          );
        }
      }
    }
    if (alvoIds.length === 0) {
      throw new ConflictException('Nenhum item pendente de decisão neste pedido');
    }

    const status = input.acao === 'aprovar' ? ('APROVADO' as const) : ('REJEITADO' as const);
    const decisoes = alvoIds.map((itemId) => ({ itemId, status }));
    const restantes = pendentes.filter((item) => !alvoIds.includes(item.id));

    if (restantes.length === 0) {
      const conclusao = await this.criarPedidoService.concluirPedidoAposDecisao({
        pedidoId: pedido.id,
        solicitacaoId: solicitacao.id,
        decisoes,
        aprovadorUsuarioId: input.usuarioId,
        aprovadorVendedorId: aprovadorVendedor.id,
      });
      return { concluido: true, resultado: conclusao.resultado };
    }

    await this.prisma.pedidoItem.updateMany({
      where: { id: { in: alvoIds }, pedidoId: pedido.id, statusAprovacao: 'PENDENTE' },
      data: {
        statusAprovacao: status,
        decididoPorId: input.usuarioId,
        decididoEm: new Date(),
      },
    });
    return { concluido: false, resultado: null };
  }

  // Aceitar/recusar a SOLICITACAO inteira (tela de Aprovacoes, web e mobile)
  // = decidir todos os itens que ainda estao pendentes de uma vez. Solicitacao
  // sem pedido vinculado (legado) segue o fluxo antigo, so' da solicitacao.
  async decidirSolicitacao(
    solicitacaoId: string,
    usuarioId: string,
    acao: AcaoDecisaoDesconto,
  ): Promise<SolicitacaoDescontoDto> {
    const solicitacao = await this.prisma.solicitacaoDesconto.findUnique({
      where: { id: solicitacaoId },
      select: { id: true, pedidoId: true },
    });
    if (!solicitacao) {
      throw new NotFoundException(`Solicitacao de desconto ${solicitacaoId} nao encontrada`);
    }

    if (!solicitacao.pedidoId) {
      return acao === 'aprovar'
        ? this.solicitacoesDescontoService.aprovar(solicitacaoId, usuarioId)
        : this.solicitacoesDescontoService.rejeitar(solicitacaoId, usuarioId);
    }

    await this.decidir({ pedidoId: solicitacao.pedidoId, acao, usuarioId });
    return this.solicitacoesDescontoService.obterDto(solicitacaoId);
  }
}
