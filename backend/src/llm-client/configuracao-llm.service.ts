import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoLlmDto {
  provedor: string;
  modelo: string;
  // 2026-09-25 - liga/desliga o fallback em cadeia entre chaves (ver
  // ChaveLlmService/LlmClientService). Default LIGADO.
  fallbackAtivo: boolean;
  atualizadoEm: string;
}

export interface AtualizarConfiguracaoLlmInput {
  provedor?: string;
  modelo?: string;
  fallbackAtivo?: boolean;
}

// Singleton (1 linha) - so provedor/modelo/fallbackAtivo, compartilhado
// entre todas as chaves (ver ChaveLlmService, 2026-09-24: a(s) chave(s) em
// si saíram desta tabela - suporte a multiplas chaves com fallback em
// cadeia).
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
        modelo: input.modelo,
        fallbackAtivo: input.fallbackAtivo,
      },
    });
    return paraDto(atualizado);
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
  fallbackAtivo: boolean;
  atualizadoEm: Date;
}): ConfiguracaoLlmDto {
  return {
    provedor: config.provedor,
    modelo: config.modelo,
    fallbackAtivo: config.fallbackAtivo,
    atualizadoEm: config.atualizadoEm.toISOString(),
  };
}
