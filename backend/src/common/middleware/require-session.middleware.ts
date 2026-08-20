import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// idpAuth.requireAuth (idp-client) SEMPRE redireciona (302) pro login
// quando nao ha sessao - certo pra sistemas navegaveis (paginas inteiras),
// mas errado pra endpoints JSON puros como os desta OS (consumidos por
// fetch do Next.js/mobile, nao por navegacao direta do navegador): um
// cliente HTTP recebendo 302 pra uma pagina de login HTML nao tem como
// tratar isso como "nao autenticado" de forma limpa.
//
// Esse middleware so verifica a PRESENCA da sessao e curto-circuita com
// 401 quando ausente - nunca reimplementa verificacao/renovacao de JWT
// (isso continua inteiramente dentro de requireAuth, aplicado em seguida
// no MiddlewareConsumer de cada modulo). Cobre o caso comum (sem sessao
// nenhuma); o caso raro de sessao presente porem com token expirado E
// falha na renovacao ainda cai no redirect padrao do requireAuth - mesmo
// comportamento de qualquer outro sistema que usa a lib, nao alterado aqui.
@Injectable()
export class RequireSessionMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (!req.session?.idpAuth) {
      next(new UnauthorizedException());
      return;
    }
    next();
  }
}
