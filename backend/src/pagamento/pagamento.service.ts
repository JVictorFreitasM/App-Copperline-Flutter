import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraAdminCondicaoPagamentoDto,
  paraAdminFormaPagamentoDto,
  paraCondicaoPagamentoDto,
  paraFormaPagamentoDto,
  type AdminCondicaoPagamentoDto,
  type AdminFormaPagamentoDto,
  type CondicaoPagamentoDto,
  type FormaPagamentoDto,
} from './dto/pagamento-response.dto';

// Leitura dos catalogos sincronizados de forma/condicao de pagamento (ver
// sync/strategies/forma-pagamento.sync.ts e condicao-pagamento.sync.ts) -
// preparacao pro envio de pedido ao ERP (ver OS-pendentes-claude-code.md).
// Filtro de "so o que pode ser usado agora" fica aqui (service de leitura),
// nao na sync - mesmo criterio ja documentado nos comentarios do schema.
@Injectable()
export class PagamentoService {
  constructor(private readonly prisma: PrismaService) {}

  // So as ativas (inativa=false) e nao desativadas manualmente pelo admin
  // (desativadaManualmente=false, ver AdminPagamentoController) - decisao
  // confirmada com o usuario: quem cria pedido nunca deve poder escolher
  // uma forma desativada no Radar OU desativada manualmente no painel.
  async listarFormasPagamento(): Promise<FormaPagamentoDto[]> {
    const formas = await this.prisma.formaPagamento.findMany({
      where: { inativa: false, desativadaManualmente: false },
      orderBy: { descricao: 'asc' },
    });
    return formas.map(paraFormaPagamentoDto);
  }

  // So as ainda vigentes: sem data de validade, ou validade >= hoje. O
  // endpoint do Radar nao tem flag de "ativa" (ver condicao-pagamento.sync.ts)
  // - `validade` e' o unico sinal, comparado aqui no momento da leitura (nao
  // gravado como um booleano derivado, que ficaria desatualizado entre syncs).
  // Tambem exclui desativada manualmente pelo admin, mesmo criterio de
  // listarFormasPagamento.
  async listarCondicoesPagamento(): Promise<CondicaoPagamentoDto[]> {
    const hoje = new Date();
    const condicoes = await this.prisma.condicaoPagamento.findMany({
      where: {
        desativadaManualmente: false,
        OR: [{ validade: null }, { validade: { gte: hoje } }],
      },
      orderBy: { nome: 'asc' },
    });
    return condicoes.map(paraCondicaoPagamentoDto);
  }

  // Leitura admin (GET /admin/formas-pagamento) - traz TODAS, inclusive
  // inativas no Radar, pra alimentar o painel de ativar/desativar (ver
  // AdminPagamentoController).
  async listarTodasFormasPagamento(): Promise<AdminFormaPagamentoDto[]> {
    const formas = await this.prisma.formaPagamento.findMany({
      orderBy: { descricao: 'asc' },
    });
    return formas.map(paraAdminFormaPagamentoDto);
  }

  async listarTodasCondicoesPagamento(): Promise<AdminCondicaoPagamentoDto[]> {
    const condicoes = await this.prisma.condicaoPagamento.findMany({
      orderBy: { nome: 'asc' },
    });
    return condicoes.map(paraAdminCondicaoPagamentoDto);
  }

  async atualizarAtivoFormaPagamento(
    id: string,
    ativo: boolean,
  ): Promise<AdminFormaPagamentoDto> {
    await this.obterFormaPagamentoOuFalhar(id);
    const forma = await this.prisma.formaPagamento.update({
      where: { id },
      data: { desativadaManualmente: !ativo },
    });
    return paraAdminFormaPagamentoDto(forma);
  }

  async atualizarAtivoCondicaoPagamento(
    id: string,
    ativo: boolean,
  ): Promise<AdminCondicaoPagamentoDto> {
    await this.obterCondicaoPagamentoOuFalhar(id);
    const condicao = await this.prisma.condicaoPagamento.update({
      where: { id },
      data: { desativadaManualmente: !ativo },
    });
    return paraAdminCondicaoPagamentoDto(condicao);
  }

  private async obterFormaPagamentoOuFalhar(id: string) {
    const forma = await this.prisma.formaPagamento.findUnique({ where: { id } });
    if (!forma) {
      throw new NotFoundException(`Forma de pagamento '${id}' não encontrada`);
    }
    return forma;
  }

  private async obterCondicaoPagamentoOuFalhar(id: string) {
    const condicao = await this.prisma.condicaoPagamento.findUnique({ where: { id } });
    if (!condicao) {
      throw new NotFoundException(`Condição de pagamento '${id}' não encontrada`);
    }
    return condicao;
  }
}
