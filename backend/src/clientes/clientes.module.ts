import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { LlmClientModule } from '../llm-client/llm-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { ClienteEstatisticasService } from './cliente-estatisticas.service';
import { ClienteResumoLlmService } from './cliente-resumo-llm.service';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  // LlmClientModule/RedisModule importados so pelo GET /clientes/:id/resumo
  // (OS-BACKEND-20). UsuariosModule/VendedoresModule (OS-BACKEND-23) pro
  // escopo por vendedor (VendedorEscopoService).
  imports: [PrismaModule, LlmClientModule, RedisModule, UsuariosModule, VendedoresModule],
  controllers: [ClientesController],
  providers: [ClientesService, ClienteResumoLlmService, ClienteEstatisticasService],
})
export class ClientesModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    // RequireSessionMiddleware primeiro (401 se nao houver sessao nenhuma -
    // API JSON, ver comentario no proprio middleware), requireAuth depois
    // (verificacao/renovacao real do token, nunca reimplementada aqui).
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(ClientesController);
  }
}
