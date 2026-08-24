import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface MensagemPush {
  titulo: string;
  corpo: string;
  dados?: Record<string, string>;
}

export interface ResultadoEnvioPush {
  sucesso: string[];
  falha: string[];
}

// Wrapper fino sobre firebase-admin (OS-BACKEND-19) - unico ponto que fala
// com o Firebase Cloud Messaging. Credencial via FIREBASE_SERVICE_ACCOUNT_JSON
// (JSON do service account serializado numa env var) - fail-closed/erro
// claro se ausente ou invalida, mesmo padrao ja usado com WK_BI_*/WK_RADAR_*
// (nunca assumir um valor default pra credencial de servico externo).
//
// ATENCAO: sem credencial real configurada nesta OS (decisao do usuario) -
// o app so falha ao tentar enviar de verdade (`enviar()`), nao ao subir -
// assim o resto do backend funciona normalmente ate a credencial ser
// fornecida, so o disparo de push fica pendente/com erro registrado em
// EventoNotificacao (ver NotificacaoDispatchService).
@Injectable()
export class PushNotificationClientService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationClientService.name);
  private app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const credencialBruta = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    if (!credencialBruta) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON não configurada - envio de push ficará indisponível até ser configurada.',
      );
      return;
    }

    try {
      const credencial = JSON.parse(credencialBruta);
      this.app = initializeApp({ credential: cert(credencial) });
    } catch (error) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON inválida (não é um JSON de service account válido): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async enviar(tokens: string[], mensagem: MensagemPush): Promise<ResultadoEnvioPush> {
    if (!this.app) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON não configurada - não é possível enviar push ainda.',
      );
    }
    if (tokens.length === 0) {
      return { sucesso: [], falha: [] };
    }

    const resposta = await getMessaging(this.app).sendEachForMulticast({
      tokens,
      notification: { title: mensagem.titulo, body: mensagem.corpo },
      data: mensagem.dados,
    });

    const sucesso: string[] = [];
    const falha: string[] = [];
    resposta.responses.forEach((resultado, indice) => {
      (resultado.success ? sucesso : falha).push(tokens[indice]);
    });

    return { sucesso, falha };
  }
}
