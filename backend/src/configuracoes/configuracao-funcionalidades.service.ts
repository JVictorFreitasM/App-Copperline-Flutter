import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoFuncionalidadesDto {
  envioPedidosHabilitado: boolean;
  cadastroClientesHabilitado: boolean;
  envioClientesErpHabilitado: boolean;
  atualizadoEm: string;
}

export interface AtualizarConfiguracaoFuncionalidadesInput {
  envioPedidosHabilitado: boolean;
  cadastroClientesHabilitado: boolean;
  envioClientesErpHabilitado: boolean;
}

// Singleton (1 linha) - aba "Funcionalidades" da tela de Configuracoes. Quem
// aplica a regra (CriarPedidoService, FilaPendenteService, ClienteCadastroService)
// consulta aqui; o front so reflete o estado (a regra nunca vive so no client).
@Injectable()
export class ConfiguracaoFuncionalidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async obter(): Promise<ConfiguracaoFuncionalidadesDto> {
    return this.paraDto(await this.obterOuCriarLinha());
  }

  async atualizar(
    input: AtualizarConfiguracaoFuncionalidadesInput,
  ): Promise<ConfiguracaoFuncionalidadesDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.configuracaoFuncionalidades.update({
      where: { id: existente.id },
      data: input,
    });
    return this.paraDto(atualizado);
  }

  // Envio de cliente ao ERP: enquanto o admin nao decidir no painel (coluna
  // null), continua valendo a env CLIENTE_ENVIO_ERP_HABILITADO de antes.
  private paraDto(config: LinhaFuncionalidades): ConfiguracaoFuncionalidadesDto {
    return {
      envioPedidosHabilitado: config.envioPedidosHabilitado,
      cadastroClientesHabilitado: config.cadastroClientesHabilitado,
      envioClientesErpHabilitado:
        config.envioClientesErpHabilitado ??
        this.configService.get<string>('CLIENTE_ENVIO_ERP_HABILITADO') === 'true',
      atualizadoEm: config.atualizadoEm.toISOString(),
    };
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.configuracaoFuncionalidades.findFirst();
    if (existente) return existente;
    return this.prisma.configuracaoFuncionalidades.create({ data: {} });
  }
}

interface LinhaFuncionalidades {
  envioPedidosHabilitado: boolean;
  cadastroClientesHabilitado: boolean;
  envioClientesErpHabilitado: boolean | null;
  atualizadoEm: Date;
}
