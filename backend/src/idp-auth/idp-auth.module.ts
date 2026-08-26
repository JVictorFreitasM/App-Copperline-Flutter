import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createIdpAuth, type IdpAuth } from '@copperline/idp-client';
import { IDP_AUTH } from './idp-auth.constants';

@Global()
@Module({
  providers: [
    {
      provide: IDP_AUTH,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): IdpAuth =>
        createIdpAuth({
          idpUrl: configService.getOrThrow<string>('IDP_URL'),
          authorizeUrl: configService.get<string>('IDP_AUTHORIZE_URL'),
          clientId: configService.getOrThrow<string>('IDP_CLIENT_ID'),
          clientSecret: configService.getOrThrow<string>('IDP_CLIENT_SECRET'),
          redirectUri: configService.getOrThrow<string>('IDP_REDIRECT_URI'),
          // Sem isso, o fallback pos-login da lib é "/" relativo ao
          // próprio BACKEND (ver skill idp-client) - só não aparece quando
          // o login começa por GET /auth/login (que grava um `returnTo`
          // próprio antes de redirecionar pro IdP, ver login-url.ts no
          // front). Quem entra direto pelo card do portal do IdP (sem
          // passar por /auth/login) não tem returnTo nenhum salvo, cai
          // nesse fallback e vê um 404 cru na API em vez do site.
          postLoginRedirect: configService.get<string>('FRONTEND_PUBLIC_URL'),
        }),
    },
  ],
  exports: [IDP_AUTH],
})
export class IdpAuthModule {}
