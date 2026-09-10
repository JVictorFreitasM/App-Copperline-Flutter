import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoTabelaPrecoDto {
  codigoSelecionado: string | null;
  atualizadoEm: string;
}

// Singleton (1 linha) - mesmo padrao ja usado por ConfiguracaoLlmService/
// SyncConfigService: obterOuCriar com default, atualizar faz upsert do
// campo informado. Qual codigo o sync deve acompanhar (pedido do usuario:
// "pegue apenas a tabela 110") - sem selecao, TabelaPrecoSyncStrategy.fetch()
// nao consulta a API nenhuma (ver comentario la).
@Injectable()
export class ConfiguracaoTabelaPrecoService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<ConfiguracaoTabelaPrecoDto> {
    const config = await this.obterOuCriarLinha();
    return paraDto(config);
  }

  // Uso interno de TabelaPrecoSyncStrategy/PrecoProdutoService - so o
  // codigo cru, sem serializar pra DTO.
  async obterCodigoSelecionado(): Promise<string | null> {
    const config = await this.obterOuCriarLinha();
    return config.codigoSelecionado;
  }

  async selecionar(codigo: string): Promise<ConfiguracaoTabelaPrecoDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.configuracaoTabelaPreco.update({
      where: { id: existente.id },
      data: { codigoSelecionado: codigo },
    });
    return paraDto(atualizado);
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.configuracaoTabelaPreco.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.configuracaoTabelaPreco.create({ data: {} });
  }
}

function paraDto(config: {
  codigoSelecionado: string | null;
  atualizadoEm: Date;
}): ConfiguracaoTabelaPrecoDto {
  return {
    codigoSelecionado: config.codigoSelecionado,
    atualizadoEm: config.atualizadoEm.toISOString(),
  };
}
