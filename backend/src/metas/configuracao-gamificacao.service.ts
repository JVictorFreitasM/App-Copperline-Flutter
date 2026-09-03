import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoGamificacaoDto {
  rankingVisivelParaVendedor: boolean;
  atualizadoEm: string;
}

// Singleton (1 linha, mesmo padrao de ConfiguracaoDescontoService) - flag
// de visibilidade do ranking de equipe (OS-BACKEND-44/GET /equipe/ranking).
@Injectable()
export class ConfiguracaoGamificacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<ConfiguracaoGamificacaoDto> {
    const config = await this.obterOuCriarLinha();
    return paraDto(config);
  }

  async atualizar(rankingVisivelParaVendedor: boolean): Promise<ConfiguracaoGamificacaoDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.configuracaoGamificacao.update({
      where: { id: existente.id },
      data: { rankingVisivelParaVendedor },
    });
    return paraDto(atualizado);
  }

  // Uso interno de RankingEquipeService - le so o booleano.
  async obterRankingVisivelParaVendedor(): Promise<boolean> {
    const config = await this.obterOuCriarLinha();
    return config.rankingVisivelParaVendedor;
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.configuracaoGamificacao.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.configuracaoGamificacao.create({ data: {} });
  }
}

function paraDto(config: {
  rankingVisivelParaVendedor: boolean;
  atualizadoEm: Date;
}): ConfiguracaoGamificacaoDto {
  return {
    rankingVisivelParaVendedor: config.rankingVisivelParaVendedor,
    atualizadoEm: config.atualizadoEm.toISOString(),
  };
}
