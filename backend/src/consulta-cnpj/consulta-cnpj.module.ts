import { HttpModule } from '@nestjs/axios';
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { ConsultaCepModule } from '../consulta-cep/consulta-cep.module';
import { MunicipioWkModule } from '../municipio-wk/municipio-wk.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { BrasilApiCnpjClientService } from './brasilapi-cnpj-client.service';
import { ConsultaCnpjCacheService } from './consulta-cnpj-cache.service';
import { ConsultaCnpjController } from './consulta-cnpj.controller';
import { ConsultaCnpjService } from './consulta-cnpj.service';
import { OrcamentoProvedorService } from './orcamento-provedor.service';
import { ReceitaWsClientService } from './receitaws-client.service';

@Module({
  imports: [
    HttpModule,
    RedisModule,
    PrismaModule,
    ConsultaCepModule,
    MunicipioWkModule,
  ],
  controllers: [ConsultaCnpjController],
  providers: [
    ConsultaCnpjService,
    ReceitaWsClientService,
    ConsultaCnpjCacheService,
    BrasilApiCnpjClientService,
    OrcamentoProvedorService,
    RateLimitGuard,
  ],
  exports: [ConsultaCnpjService],
})
export class ConsultaCnpjModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(ConsultaCnpjController);
  }
}
