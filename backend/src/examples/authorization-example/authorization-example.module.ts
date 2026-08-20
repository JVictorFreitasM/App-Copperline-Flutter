import {
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { IDP_AUTH } from '../../idp-auth/idp-auth.constants';
import { AuthorizationExampleController } from './authorization-example.controller';

@Module({
  controllers: [AuthorizationExampleController],
})
export class AuthorizationExampleModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    // requireAuth sozinho - qualquer usuario autenticado no SSO acessa.
    consumer.apply(this.idpAuth.requireAuth).forRoutes({
      path: 'exemplos/autorizacao/perfil',
      method: RequestMethod.GET,
    });

    // requireAuth + requireRole encadeados - so usuario autenticado E com
    // o role 'admin' acessa.
    consumer.apply(this.idpAuth.requireAuth, requireRole('admin')).forRoutes({
      path: 'exemplos/autorizacao/admin',
      method: RequestMethod.POST,
    });

    // /sync-manual fica de fora do requireAuth de proposito: e um endpoint
    // de automacao/servico, protegido so por ApiKeyGuard (ver controller),
    // nao por sessao de usuario via SSO.
  }
}
