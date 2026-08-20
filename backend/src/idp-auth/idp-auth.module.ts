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
        }),
    },
  ],
  exports: [IDP_AUTH],
})
export class IdpAuthModule {}
