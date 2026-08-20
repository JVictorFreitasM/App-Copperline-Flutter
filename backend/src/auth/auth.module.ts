import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
})
export class AuthModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(this.idpAuth.requireAuth).forRoutes(AuthController);
  }
}
