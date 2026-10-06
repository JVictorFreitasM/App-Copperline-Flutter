import { BullModule } from '@nestjs/bullmq';
import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { ConsultaCepModule } from '../consulta-cep/consulta-cep.module';
import { ErpClientModule } from '../erp-client/erp-client.module';
import { MunicipioWkModule } from '../municipio-wk/municipio-wk.module';
import { FinanceiroSvcClientModule } from '../financeiro-svc-client/financeiro-svc-client.module';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { LlmClientModule } from '../llm-client/llm-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TabelasPrecoModule } from '../tabelas-preco/tabelas-preco.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { VendedoresModule } from '../vendedores/vendedores.module';
import { VisitasModule } from '../visitas/visitas.module';
import { ClienteBoletoService } from './cliente-boleto.service';
import { ClienteCadastroService } from './cliente-cadastro.service';
import { ClienteEdicaoService } from './cliente-edicao.service';
import { EnderecoClienteService } from './endereco-cliente.service';
import { CLIENTE_ENVIO_ERP_QUEUE } from './cliente-envio-erp.constants';
import { ClienteEnvioErpProcessor } from './cliente-envio-erp.processor';
import { ClienteEnvioErpScheduler } from './cliente-envio-erp.scheduler';
import { ClienteEnvioErpService } from './cliente-envio-erp.service';
import { ClienteEstatisticasService } from './cliente-estatisticas.service';
import { ClienteTimelineService } from './cliente-timeline.service';
import { ClienteFinanceiroService } from './cliente-financeiro.service';
import { ClienteLocalizacaoService } from './cliente-localizacao.service';
import { ClienteResumoLlmService } from './cliente-resumo-llm.service';
import { VisitaResumoLlmService } from './visita-resumo-llm.service';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  // LlmClientModule/RedisModule importados so pelo GET /clientes/:id/resumo
  // (OS-BACKEND-20). UsuariosModule/VendedoresModule (OS-BACKEND-23) pro
  // escopo por vendedor (VendedorEscopoService). VisitasModule (OS-BACKEND-28)
  // pro GET /clientes/:id/visitas. FinanceiroSvcClientModule (OS-BACKEND-36
  // revisao + OS-BACKEND-43) pro GET /clientes/:id/financeiro (SOAP
  // Financeiro.svc, BuscarPosicaoFinanceira) e /:id/titulos/:numeroDocumento/
  // boleto (BuscarTokenBoleto + DownloadBoleto).
  imports: [
    PrismaModule,
    LlmClientModule,
    RedisModule,
    UsuariosModule,
    VendedoresModule,
    VisitasModule,
    FinanceiroSvcClientModule,
    TabelasPrecoModule,
    // Cadastro de cliente novo (POST /clientes): CEP -> IBGE, IBGE -> municipio do
    // Radar e fila de envio ao Radar.
    ConsultaCepModule,
    MunicipioWkModule,
    ErpClientModule,
    BullModule.registerQueue({ name: CLIENTE_ENVIO_ERP_QUEUE }),
  ],
  controllers: [ClientesController],
  providers: [
    ClientesService,
    ClienteResumoLlmService,
    VisitaResumoLlmService,
    ClienteEstatisticasService,
    ClienteLocalizacaoService,
    ClienteFinanceiroService,
    ClienteBoletoService,
    ClienteTimelineService,
    ClienteCadastroService,
    ClienteEdicaoService,
    EnderecoClienteService,
    ClienteEnvioErpService,
    ClienteEnvioErpProcessor,
    ClienteEnvioErpScheduler,
  ],
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
