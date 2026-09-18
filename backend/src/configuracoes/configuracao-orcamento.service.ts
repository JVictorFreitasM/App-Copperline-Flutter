import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoOrcamentoDto {
  habilitarCriacaoOrcamento: boolean;
  permitirVendedorTransformarEmPedido: boolean;
  criarPedidoSugeridoComoOrcamento: boolean;
  permitirAlteracaoVendedorOrcamentoCriado: boolean;
  atualizadoEm: string;
}

export interface AtualizarConfiguracaoOrcamentoInput {
  habilitarCriacaoOrcamento: boolean;
  permitirVendedorTransformarEmPedido: boolean;
  criarPedidoSugeridoComoOrcamento: boolean;
  permitirAlteracaoVendedorOrcamentoCriado: boolean;
}

// Singleton (1 linha) - aba "Orcamento" da tela de Configuracoes (Epico 4,
// OS-dashboard-configuracoes-notificacoes-auditoria.md), mesmo padrao ja
// usado por ConfiguracaoTabelaPrecoService/ConfiguracaoDescontoService.
@Injectable()
export class ConfiguracaoOrcamentoService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<ConfiguracaoOrcamentoDto> {
    const config = await this.obterOuCriarLinha();
    return paraDto(config);
  }

  async atualizar(
    input: AtualizarConfiguracaoOrcamentoInput,
  ): Promise<ConfiguracaoOrcamentoDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.configuracaoOrcamento.update({
      where: { id: existente.id },
      data: input,
    });
    return paraDto(atualizado);
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.configuracaoOrcamento.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.configuracaoOrcamento.create({ data: {} });
  }
}

function paraDto(config: {
  habilitarCriacaoOrcamento: boolean;
  permitirVendedorTransformarEmPedido: boolean;
  criarPedidoSugeridoComoOrcamento: boolean;
  permitirAlteracaoVendedorOrcamentoCriado: boolean;
  atualizadoEm: Date;
}): ConfiguracaoOrcamentoDto {
  return {
    habilitarCriacaoOrcamento: config.habilitarCriacaoOrcamento,
    permitirVendedorTransformarEmPedido: config.permitirVendedorTransformarEmPedido,
    criarPedidoSugeridoComoOrcamento: config.criarPedidoSugeridoComoOrcamento,
    permitirAlteracaoVendedorOrcamentoCriado: config.permitirAlteracaoVendedorOrcamentoCriado,
    atualizadoEm: config.atualizadoEm.toISOString(),
  };
}
