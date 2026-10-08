import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoFuncionalidadesDto {
  envioPedidosHabilitado: boolean;
  cadastroClientesHabilitado: boolean;
  atualizadoEm: string;
}

export interface AtualizarConfiguracaoFuncionalidadesInput {
  envioPedidosHabilitado: boolean;
  cadastroClientesHabilitado: boolean;
}

// Singleton (1 linha) - aba "Funcionalidades" da tela de Configuracoes. Quem
// aplica a regra (CriarPedidoService, FilaPendenteService, ClienteCadastroService)
// consulta aqui; o front so reflete o estado (a regra nunca vive so no client).
@Injectable()
export class ConfiguracaoFuncionalidadesService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<ConfiguracaoFuncionalidadesDto> {
    return paraDto(await this.obterOuCriarLinha());
  }

  async atualizar(
    input: AtualizarConfiguracaoFuncionalidadesInput,
  ): Promise<ConfiguracaoFuncionalidadesDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.configuracaoFuncionalidades.update({
      where: { id: existente.id },
      data: input,
    });
    return paraDto(atualizado);
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.configuracaoFuncionalidades.findFirst();
    if (existente) return existente;
    return this.prisma.configuracaoFuncionalidades.create({ data: {} });
  }
}

function paraDto(config: {
  envioPedidosHabilitado: boolean;
  cadastroClientesHabilitado: boolean;
  atualizadoEm: Date;
}): ConfiguracaoFuncionalidadesDto {
  return {
    envioPedidosHabilitado: config.envioPedidosHabilitado,
    cadastroClientesHabilitado: config.cadastroClientesHabilitado,
    atualizadoEm: config.atualizadoEm.toISOString(),
  };
}
