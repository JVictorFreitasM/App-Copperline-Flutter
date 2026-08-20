import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import type { IdpAuth } from '@copperline/idp-client';
import { AppModule } from './app.module';
import { IDP_AUTH } from './idp-auth/idp-auth.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Validacao real de todo input de rota via class-validator (DTOs) - nunca
  // confiar so em validacao do lado client (ver skill security-review,
  // item "Falta de tratamento de inputs"). whitelist remove campos nao
  // declarados no DTO em vez de rejeitar a requisicao (evita quebrar em
  // parametros incidentais, ex: cache-busting de proxy/browser).
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  app.use(
    session({
      secret: configService.getOrThrow<string>('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // Sem domain, o cookie so e enviado pro host exato que o emitiu.
        // Em dev isso ja funciona pro Next.js (mesmo host "localhost", so
        // porta diferente - cookie nao e escopado por porta), mas em
        // produção, se front e back estiverem em subdominios diferentes
        // (ex: app.copperline.com.br / api.copperline.com.br), precisa do
        // domain do pai (ex: ".copperline.com.br") pra o cookie de sessao
        // ser enviado nos requests que o Next.js Server Component/
        // middleware encaminha ao backend (ver OS 10, sistema web).
        domain: configService.get<string>('SESSION_COOKIE_DOMAIN'),
      },
    }),
  );

  const idpAuth = app.get<IdpAuth>(IDP_AUTH);
  app.use(idpAuth.router);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
