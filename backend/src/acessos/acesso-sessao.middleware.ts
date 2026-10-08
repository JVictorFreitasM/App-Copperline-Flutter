import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { AcessosService, AcessoSessao } from './acessos.service';
import {
  plataformaDaRequisicao,
  resumirDispositivo,
  subDoAccessToken,
} from './informacao-sessao';

const ATUALIZA_ULTIMO_ACESSO_A_CADA_MS = 60_000;
const logger = new Logger('AcessoSessao');

function cabecalho(req: Request, nome: string): string | undefined {
  const valor = req.headers[nome];
  return Array.isArray(valor) ? valor[0] : valor;
}

// Roda em TODA requisicao, depois do express-session e antes das rotas:
// 1) conta bloqueada -> destroi a sessao e responde 403 (vale tambem pra quem
//    ja tinha sessao aberta e para quem acabou de logar de novo);
// 2) registra aparelho/IP/ultimo acesso na propria sessao (alimenta a tela
//    Acessos), no maximo 1 gravacao por minuto.
// Falha aqui NUNCA derruba a requisicao (so' deixa de registrar).
export function criarMiddlewareAcesso(acessos: Pick<AcessosService, 'estaBloqueado'>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessao = req.session as
        | (Request['session'] & { idpAuth?: { accessToken?: unknown }; acesso?: AcessoSessao })
        | undefined;
      if (!sessao?.idpAuth) {
        next();
        return;
      }
      const sub = subDoAccessToken(sessao.idpAuth.accessToken);
      if (sub && (await acessos.estaBloqueado(sub))) {
        sessao.destroy(() => {
          res.status(403).json({
            statusCode: 403,
            error: 'CONTA_BLOQUEADA',
            message: 'Sua conta foi bloqueada. Fale com o administrador.',
          });
        });
        return;
      }

      const agora = Date.now();
      const anterior = sessao.acesso;
      if (!anterior || agora - Date.parse(anterior.ultimoAcessoEm) >= ATUALIZA_ULTIMO_ACESSO_A_CADA_MS) {
        const userAgentRepassado = cabecalho(req, 'x-cliente-user-agent');
        const userAgentDireto = cabecalho(req, 'user-agent');
        const plataforma = plataformaDaRequisicao({
          appCliente: cabecalho(req, 'x-app-cliente'),
          userAgentRepassado,
          userAgent: userAgentDireto,
        });
        sessao.acesso = {
          plataforma,
          dispositivo: resumirDispositivo(plataforma, userAgentRepassado ?? userAgentDireto),
          ip: cabecalho(req, 'x-cliente-ip') ?? req.ip ?? null,
          criadoEm: anterior?.criadoEm ?? new Date(agora).toISOString(),
          ultimoAcessoEm: new Date(agora).toISOString(),
        };
      }
    } catch (erro) {
      logger.warn(`Falha ao verificar/registrar acesso: ${String(erro)}`);
    }
    next();
  };
}
