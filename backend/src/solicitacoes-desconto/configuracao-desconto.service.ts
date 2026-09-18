import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoDescontoDto {
  limitePercentual: number;
  habilitarAprovacaoPorAlcada: boolean;
  percentualAlcadaGerencial: number;
  percentualAlcadaSupervisao: number;
  atualizadoEm: string;
}

// Campos opcionais: o endpoint ops (admin/configuracao-desconto,
// ApiKeyGuard) so envia limitePercentual; o endpoint web novo da aba
// "Alcada de Aprovacao" (admin/configuracoes/alcada-aprovacao,
// requireRole('admin')) envia os 4 campos - so os informados sao
// persistidos.
export interface AtualizarConfiguracaoDescontoInput {
  limitePercentual?: number;
  habilitarAprovacaoPorAlcada?: boolean;
  percentualAlcadaGerencial?: number;
  percentualAlcadaSupervisao?: number;
}

// Singleton (1 linha) - mesmo padrao ja usado por ConfiguracaoLlmService
// (OS-BACKEND-20): obterOuCriar com default, atualizar faz update do campo
// informado. Limite de desconto vive em tabela (nao env var) porque e'
// regra de negocio ajustavel sem deploy, nao credencial (ver comentario no
// schema.prisma, model ConfiguracaoDesconto).
@Injectable()
export class ConfiguracaoDescontoService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<ConfiguracaoDescontoDto> {
    const config = await this.obterOuCriarLinha();
    return paraDto(config);
  }

  async atualizar(
    input: AtualizarConfiguracaoDescontoInput,
  ): Promise<ConfiguracaoDescontoDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.configuracaoDesconto.update({
      where: { id: existente.id },
      data: {
        ...(input.limitePercentual !== undefined && {
          limitePercentual: input.limitePercentual,
        }),
        ...(input.habilitarAprovacaoPorAlcada !== undefined && {
          habilitarAprovacaoPorAlcada: input.habilitarAprovacaoPorAlcada,
        }),
        ...(input.percentualAlcadaGerencial !== undefined && {
          percentualAlcadaGerencial: input.percentualAlcadaGerencial,
        }),
        ...(input.percentualAlcadaSupervisao !== undefined && {
          percentualAlcadaSupervisao: input.percentualAlcadaSupervisao,
        }),
      },
    });
    return paraDto(atualizado);
  }

  // Uso interno do SolicitacoesDescontoService - le so o numero, sem passar
  // pelo DTO de apresentacao.
  async obterLimitePercentual(): Promise<number> {
    const config = await this.obterOuCriarLinha();
    return config.limitePercentual.toNumber();
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.configuracaoDesconto.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.configuracaoDesconto.create({ data: {} });
  }
}

function paraDto(config: {
  limitePercentual: { toNumber(): number };
  habilitarAprovacaoPorAlcada: boolean;
  percentualAlcadaGerencial: { toNumber(): number };
  percentualAlcadaSupervisao: { toNumber(): number };
  atualizadoEm: Date;
}): ConfiguracaoDescontoDto {
  return {
    limitePercentual: config.limitePercentual.toNumber(),
    habilitarAprovacaoPorAlcada: config.habilitarAprovacaoPorAlcada,
    percentualAlcadaGerencial: config.percentualAlcadaGerencial.toNumber(),
    percentualAlcadaSupervisao: config.percentualAlcadaSupervisao.toNumber(),
    atualizadoEm: config.atualizadoEm.toISOString(),
  };
}
