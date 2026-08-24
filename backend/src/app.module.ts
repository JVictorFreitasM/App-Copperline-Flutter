import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { IdpAuthModule } from './idp-auth/idp-auth.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationExampleModule } from './examples/authorization-example/authorization-example.module';
import { SyncModule } from './sync/sync.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProdutosModule } from './produtos/produtos.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { EstoqueModule } from './estoque/estoque.module';
import { NotasFiscaisModule } from './notas-fiscais/notas-fiscais.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminSyncModule } from './admin-sync/admin-sync.module';
import { BuscaModule } from './busca/busca.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { LlmClientModule } from './llm-client/llm-client.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    }),
    PrismaModule,
    HealthModule,
    IdpAuthModule,
    AuthModule,
    AuthorizationExampleModule,
    SyncModule,
    ClientesModule,
    ProdutosModule,
    PedidosModule,
    EstoqueModule,
    NotasFiscaisModule,
    DashboardModule,
    AdminSyncModule,
    BuscaModule,
    UsuariosModule,
    NotificacoesModule,
    LlmClientModule,
  ],
})
export class AppModule {}
