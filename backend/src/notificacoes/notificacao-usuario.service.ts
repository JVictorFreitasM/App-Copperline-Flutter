import { Injectable, NotFoundException } from '@nestjs/common';
import type { TipoEventoNotificacao } from '../../generated/prisma/client';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificacaoDto {
  id: string;
  tipo: TipoEventoNotificacao;
  titulo: string;
  corpo: string;
  dados: unknown;
  referenciaId: string;
  lida: boolean;
  lidaEm: string | null;
  criadoEm: string;
}

// Detalhe de uma mensagem manual do admin (tela que abre ao tocar na
// mensagem no app): a notificacao inteira (corpo completo) + quem enviou.
export interface DetalheMensagemDto {
  autorNome: string;
  // Do ponto de vista de QUEM RECEBEU: "Todos os vendedores", "Somente você"
  // ou "Grupo: <nome>" - nunca a lista de quem mais recebeu.
  destinoRotulo: string;
  periodica: boolean;
}

export interface NotificacaoDetalheDto extends NotificacaoDto {
  // null so se a mensagem original sumiu (nao ha exclusao hoje) - a tela
  // ainda mostra titulo/corpo da notificacao.
  mensagem: DetalheMensagemDto | null;
}

// Epico 5 - "inbox" web/in-app (NotificacaoUsuario, ver comentario no
// schema.prisma), distinto do disparo de push em si
// (NotificacaoDispatchService). Linhas ja existem (criadas por
// registrarEventoNotificacao, evento-notificacao.service.ts) - este
// service so LE/marca como lida, nunca decide quem recebe o que.
@Injectable()
export class NotificacaoUsuarioService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    usuarioId: string,
    query: { page: number; limit: number; apenasNaoLidas?: boolean },
  ): Promise<PaginatedResult<NotificacaoDto>> {
    const where = {
      usuarioId,
      ...(query.apenasNaoLidas && { lida: false }),
    };

    const [notificacoes, total] = await this.prisma.$transaction([
      this.prisma.notificacaoUsuario.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { evento: true },
      }),
      this.prisma.notificacaoUsuario.count({ where }),
    ]);

    return paginar(notificacoes.map(paraDto), total, query.page, query.limit);
  }

  async contarNaoLidas(usuarioId: string): Promise<number> {
    return this.prisma.notificacaoUsuario.count({ where: { usuarioId, lida: false } });
  }

  // Detalhe de uma MENSAGEM manual do admin pra quem a recebeu (tela que abre
  // ao tocar na mensagem no app, tanto pela lista quanto pelo push - o push
  // so carrega o mensagemId, igual pra todos os destinatarios, por isso a
  // busca e' por ele e nao pelo id da notificacao de cada usuario).
  // Somente leitura (nao marca como lida - quem abre chama marcarComoLida a
  // parte). O dono entra na PROPRIA query: quem nao recebeu a mensagem tem 404,
  // nunca le o texto so por saber o id (anti-IDOR).
  async obterDetalheDaMensagem(
    usuarioId: string,
    mensagemId: string,
  ): Promise<NotificacaoDetalheDto> {
    const notificacao = await this.prisma.notificacaoUsuario.findFirst({
      where: { usuarioId, evento: { tipo: 'MENSAGEM_DIRETA', referenciaId: mensagemId } },
      include: { evento: true },
    });
    if (!notificacao) {
      throw new NotFoundException(`Mensagem '${mensagemId}' não encontrada`);
    }

    return { ...paraDto(notificacao), mensagem: await this.detalheDaMensagem(notificacao.evento) };
  }

  private async detalheDaMensagem(evento: {
    tipo: TipoEventoNotificacao;
    referenciaId: string;
  }): Promise<DetalheMensagemDto | null> {
    if (evento.tipo !== 'MENSAGEM_DIRETA') {
      return null;
    }
    const mensagem = await this.prisma.mensagemNotificacao.findUnique({
      where: { id: evento.referenciaId },
      select: {
        destino: true,
        periodicaId: true,
        autor: { select: { nome: true } },
        grupo: { select: { nome: true } },
      },
    });
    if (!mensagem) {
      return null;
    }
    const destinoRotulo =
      mensagem.destino === 'TODOS'
        ? 'Todos os vendedores'
        : mensagem.destino === 'VENDEDOR'
          ? 'Somente você'
          : `Grupo: ${mensagem.grupo?.nome ?? 'removido'}`;
    return {
      autorNome: mensagem.autor.nome,
      destinoRotulo,
      periodica: mensagem.periodicaId !== null,
    };
  }

  // 404 tanto pra id inexistente quanto pra notificacao de outro usuario
  // (anti-IDOR, mesmo criterio do resto do projeto) - nunca 403, que
  // confirmaria a existencia do id pra quem nao deveria ver.
  async marcarComoLida(usuarioId: string, id: string): Promise<NotificacaoDto> {
    const notificacao = await this.prisma.notificacaoUsuario.findFirst({
      where: { id, usuarioId },
    });
    if (!notificacao) {
      throw new NotFoundException(`Notificação '${id}' não encontrada`);
    }

    const atualizada = await this.prisma.notificacaoUsuario.update({
      where: { id },
      data: { lida: true, lidaEm: new Date() },
      include: { evento: true },
    });
    return paraDto(atualizada);
  }

  async marcarTodasComoLidas(usuarioId: string): Promise<{ quantidade: number }> {
    const resultado = await this.prisma.notificacaoUsuario.updateMany({
      where: { usuarioId, lida: false },
      data: { lida: true, lidaEm: new Date() },
    });
    return { quantidade: resultado.count };
  }
}

function paraDto(notificacao: {
  id: string;
  lida: boolean;
  lidaEm: Date | null;
  criadoEm: Date;
  evento: {
    tipo: TipoEventoNotificacao;
    titulo: string;
    corpo: string;
    dados: unknown;
    referenciaId: string;
  };
}): NotificacaoDto {
  return {
    id: notificacao.id,
    tipo: notificacao.evento.tipo,
    titulo: notificacao.evento.titulo,
    corpo: notificacao.evento.corpo,
    dados: notificacao.evento.dados,
    referenciaId: notificacao.evento.referenciaId,
    lida: notificacao.lida,
    lidaEm: notificacao.lidaEm ? notificacao.lidaEm.toISOString() : null,
    criadoEm: notificacao.criadoEm.toISOString(),
  };
}
