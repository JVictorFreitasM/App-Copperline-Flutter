import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConfiguracaoRastreioDto {
  desabilitarEdicaoHorarioTrabalhoAndroid: boolean;
  habilitarRastreamentoSabados: boolean;
  habilitarRastreamentoDomingos: boolean;
  horarioInicioRastreamento: string;
  horarioTerminoRastreamento: string;
  precisaoMinimaMetrosGps: number;
  tempoMinimoAcordarGpsMs: number;
  permitirRegistroComGpsDesabilitado: boolean;
  distanciaMaximaClienteRegistroPedidoMetros: number | null;
  distanciaMaximaClienteRegistroVisitaMetros: number;
  atualizadoEm: string;
}

export interface AtualizarConfiguracaoRastreioInput {
  desabilitarEdicaoHorarioTrabalhoAndroid: boolean;
  habilitarRastreamentoSabados: boolean;
  habilitarRastreamentoDomingos: boolean;
  horarioInicioRastreamento: string;
  horarioTerminoRastreamento: string;
  precisaoMinimaMetrosGps: number;
  tempoMinimoAcordarGpsMs: number;
  permitirRegistroComGpsDesabilitado: boolean;
  distanciaMaximaClienteRegistroPedidoMetros: number | null;
  distanciaMaximaClienteRegistroVisitaMetros: number;
}

// Singleton (1 linha) - aba "Rastreio" da tela de Configuracoes (Epico 4,
// OS-dashboard-configuracoes-notificacoes-auditoria.md). So GET/PATCH -
// o app mobile ainda nao le esses valores (escopo desta OS e so' Web),
// ver comentario no schema.prisma (model ConfiguracaoRastreio).
@Injectable()
export class ConfiguracaoRastreioService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<ConfiguracaoRastreioDto> {
    const config = await this.obterOuCriarLinha();
    return paraDto(config);
  }

  async atualizar(
    input: AtualizarConfiguracaoRastreioInput,
  ): Promise<ConfiguracaoRastreioDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.configuracaoRastreio.update({
      where: { id: existente.id },
      data: input,
    });
    return paraDto(atualizado);
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.configuracaoRastreio.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.configuracaoRastreio.create({ data: {} });
  }
}

function paraDto(config: {
  desabilitarEdicaoHorarioTrabalhoAndroid: boolean;
  habilitarRastreamentoSabados: boolean;
  habilitarRastreamentoDomingos: boolean;
  horarioInicioRastreamento: string;
  horarioTerminoRastreamento: string;
  precisaoMinimaMetrosGps: number;
  tempoMinimoAcordarGpsMs: number;
  permitirRegistroComGpsDesabilitado: boolean;
  distanciaMaximaClienteRegistroPedidoMetros: number | null;
  distanciaMaximaClienteRegistroVisitaMetros: number;
  atualizadoEm: Date;
}): ConfiguracaoRastreioDto {
  return {
    desabilitarEdicaoHorarioTrabalhoAndroid: config.desabilitarEdicaoHorarioTrabalhoAndroid,
    habilitarRastreamentoSabados: config.habilitarRastreamentoSabados,
    habilitarRastreamentoDomingos: config.habilitarRastreamentoDomingos,
    horarioInicioRastreamento: config.horarioInicioRastreamento,
    horarioTerminoRastreamento: config.horarioTerminoRastreamento,
    precisaoMinimaMetrosGps: config.precisaoMinimaMetrosGps,
    tempoMinimoAcordarGpsMs: config.tempoMinimoAcordarGpsMs,
    permitirRegistroComGpsDesabilitado: config.permitirRegistroComGpsDesabilitado,
    distanciaMaximaClienteRegistroPedidoMetros:
      config.distanciaMaximaClienteRegistroPedidoMetros,
    distanciaMaximaClienteRegistroVisitaMetros:
      config.distanciaMaximaClienteRegistroVisitaMetros,
    atualizadoEm: config.atualizadoEm.toISOString(),
  };
}
