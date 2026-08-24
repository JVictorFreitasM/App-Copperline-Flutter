import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoLlmDto {
  provedor: string;
  modelo: string;
  // Nunca a chave em si - so se ha uma configurada (ver comentario no
  // schema.prisma, model ConfiguracaoLlm).
  apiKeyConfigurada: boolean;
  atualizadoEm: string;
}

export interface AtualizarConfiguracaoLlmInput {
  provedor?: string;
  apiKey?: string;
  modelo?: string;
}

// Singleton (1 linha) - mesmo padrao ja usado por ConfiguracaoSyncEstoqueService
// (OS-BACKEND-14, removido)/SyncConfigService (OS-BACKEND-15): obterOuCriar
// com default, atualizar faz upsert dos campos informados.
@Injectable()
export class ConfiguracaoLlmService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<ConfiguracaoLlmDto> {
    const config = await this.obterOuCriarLinha();
    return paraDto(config);
  }

  async atualizar(input: AtualizarConfiguracaoLlmInput): Promise<ConfiguracaoLlmDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.configuracaoLlm.update({
      where: { id: existente.id },
      data: {
        provedor: input.provedor,
        apiKey: input.apiKey,
        modelo: input.modelo,
      },
    });
    return paraDto(atualizado);
  }

  // Uso interno do LlmClientService - unico lugar que le a apiKey crua.
  async obterCredenciais(): Promise<{
    provedor: string;
    apiKey: string | null;
    modelo: string;
  }> {
    const config = await this.obterOuCriarLinha();
    return { provedor: config.provedor, apiKey: config.apiKey, modelo: config.modelo };
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.configuracaoLlm.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.configuracaoLlm.create({ data: {} });
  }
}

function paraDto(config: {
  provedor: string;
  modelo: string;
  apiKey: string | null;
  atualizadoEm: Date;
}): ConfiguracaoLlmDto {
  return {
    provedor: config.provedor,
    modelo: config.modelo,
    apiKeyConfigurada: Boolean(config.apiKey),
    atualizadoEm: config.atualizadoEm.toISOString(),
  };
}
