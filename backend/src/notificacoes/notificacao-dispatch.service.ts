import { Injectable, Logger } from '@nestjs/common';
import type { EventoNotificacao, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationClientService } from '../push-notification-client/push-notification-client.service';

// No maximo isso por execucao do job (cron de 1 em 1 minuto, ver
// notificacao.scheduler.ts) - lote pequeno o bastante pra nao segurar a
// fila muito tempo; sobra pra proxima execucao se houver mais pendente.
const TAMANHO_LOTE = 100;

// Processa EventoNotificacao pendentes e dispara push - roda numa fila
// PROPRIA (NOTIFICACAO_QUEUE), separada da fila de sync, pra um problema
// no envio de push nunca atrasar/travar o cursor incremental de
// cliente/produto/pedido/etc (ver OS-BACKEND-19, decisao de escopo
// explicita: "job separado, fora do fluxo sincrono de sync").
@Injectable()
export class NotificacaoDispatchService {
  private readonly logger = new Logger(NotificacaoDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushClient: PushNotificationClientService,
  ) {}

  async processarPendentes(): Promise<void> {
    const pendentes = await this.prisma.eventoNotificacao.findMany({
      where: { status: 'PENDENTE' },
      orderBy: { criadoEm: 'asc' },
      take: TAMANHO_LOTE,
    });

    for (const evento of pendentes) {
      // Erro num evento nao pode travar o resto do lote - cada um e'
      // tratado isoladamente, sempre termina em ENVIADO ou ERRO (nunca
      // fica PENDENTE pra sempre por causa de uma excecao nao tratada).
      await this.processarEvento(evento);
    }
  }

  private async processarEvento(evento: EventoNotificacao): Promise<void> {
    try {
      const tokens = await this.resolverTokensAlvo(evento);
      if (tokens.length === 0) {
        // Evento legitimo, so que ninguem cadastrado pra receber (ex:
        // produto reabastecido sem nenhum favorito ainda) - nao e' erro.
        await this.marcarComo(evento.id, 'ENVIADO');
        return;
      }

      const resultado = await this.pushClient.enviar(tokens, {
        titulo: evento.titulo,
        corpo: evento.corpo,
        dados: serializarDados(evento.dados),
      });

      if (resultado.falha.length > 0) {
        this.logger.warn(
          `Evento ${evento.id} (${evento.tipo}): ${resultado.falha.length} dispositivo(s) falharam`,
        );
      }
      // Sucesso parcial ainda conta como ENVIADO (a intencao foi
      // cumprida pra quem pode receber) - o detalhe de quem falhou fica
      // registrado em `erro` pra diagnostico, nao pra retry automatico
      // (fora de escopo desta OS).
      await this.marcarComo(
        evento.id,
        'ENVIADO',
        resultado.falha.length > 0 ? { tokensComFalha: resultado.falha } : undefined,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao processar evento ${evento.id} (${evento.tipo})`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.marcarComo(evento.id, 'ERRO', {
        mensagem: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async resolverTokensAlvo(evento: EventoNotificacao): Promise<string[]> {
    if (evento.tipo === 'PRODUTO_REABASTECIDO') {
      // So quem favoritou o produto (pre-requisito da OS) - nunca
      // broadcast pra esse tipo.
      const favoritos = await this.prisma.produtoFavorito.findMany({
        where: { produtoId: evento.referenciaId },
        include: { usuario: { include: { dispositivos: true } } },
      });
      return favoritos.flatMap((f) => f.usuario.dispositivos.map((d) => d.token));
    }

    // PEDIDO_SITUACAO_ALTERADA / NOTA_FISCAL_REJEITADA: broadcast pra
    // todo mundo registrado (decisao confirmada com o usuario - sem
    // vinculo Cliente<->Usuario no sistema hoje).
    const dispositivos = await this.prisma.dispositivoUsuario.findMany();
    return dispositivos.map((d) => d.token);
  }

  private async marcarComo(
    id: string,
    status: 'ENVIADO' | 'ERRO',
    erro?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.eventoNotificacao.update({
      where: { id },
      data: { status, processadoEm: new Date(), erro: erro as unknown as Prisma.InputJsonValue },
    });
  }
}

// FCM exige que os valores de `data` sejam string - EventoNotificacao.dados
// e' Json solto (podem vir number/boolean de quem gravou o evento).
function serializarDados(dados: unknown): Record<string, string> | undefined {
  if (!dados || typeof dados !== 'object') {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(dados as Record<string, unknown>).map(([chave, valor]) => [
      chave,
      String(valor),
    ]),
  );
}
