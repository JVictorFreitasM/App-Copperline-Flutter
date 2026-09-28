import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TipoMeta, TipoPeriodicidadeMeta } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorVendasService } from '../vendedores/vendedor-vendas.service';
import type { DefinirMetaVendedorDto } from './dto/definir-meta-vendedor.dto';
import { filtroMes } from './filtro-mes';
import { filtroSemana } from './filtro-semana';

export interface MetaVendedorDto {
  vendedorId: string;
  periodicidade: TipoPeriodicidadeMeta;
  periodo: string;
  tipoMeta: TipoMeta;
  valorMeta: number;
  atualizadoEm: string;
}

export interface MetaProgressoDto {
  vendedorId: string;
  periodicidade: TipoPeriodicidadeMeta;
  periodo: string;
  // null = sem meta configurada pra esse periodo (nao e' "meta zero") -
  // tipoMeta/percentualAtingido tambem ficam null nesse caso, nunca um
  // valor inventado.
  tipoMeta: TipoMeta | null;
  valorMeta: number | null;
  valorVendido: number;
  percentualAtingido: number | null;
}

const REGEX_MES_ANO = /^\d{4}-(0[1-9]|1[0-2])$/;
const REGEX_SEMANA_ISO = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

// OS-BACKEND-44 - meta configurada pelo admin/supervisor (definir()) e
// progresso calculado a partir de Pedido ja sincronizado (obterProgresso(),
// via VendedorVendasService - mesma atribuicao por vinculo
// Cliente-Vendedor do ranking do painel web).
//
// Pedido do usuario (2026-09-28): 3 tipos de meta (Dinheiro/Peso/Margem,
// so um ativo por vez por periodo - trocar tipoMeta e' so um update no
// mesmo registro) e 2 periodicidades que podem coexistir (mensal E
// semanal, cada uma com seu proprio registro/tipo/progresso independente).
// MARGEM ainda nao tem calculo de progresso implementado - so existe como
// nome selecionavel (valorVendido sempre 0, percentualAtingido sempre
// null pra esse tipo), ate a regra de calculo de margem ser definida.
@Injectable()
export class MetaVendedorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendedorVendasService: VendedorVendasService,
  ) {}

  async definir(
    vendedorId: string,
    dto: DefinirMetaVendedorDto,
  ): Promise<MetaVendedorDto> {
    const vendedor = await this.prisma.vendedor.findUnique({
      where: { id: vendedorId },
    });
    if (!vendedor) {
      throw new NotFoundException(`Vendedor ${vendedorId} nao encontrado`);
    }
    this.validarPeriodo(dto.periodicidade, dto.periodo);

    const meta = await this.prisma.metaVendedor.upsert({
      where: {
        vendedorId_periodicidade_periodo: {
          vendedorId,
          periodicidade: dto.periodicidade,
          periodo: dto.periodo,
        },
      },
      create: {
        vendedorId,
        periodicidade: dto.periodicidade,
        periodo: dto.periodo,
        tipoMeta: dto.tipoMeta,
        valorMeta: dto.valorMeta,
      },
      update: { tipoMeta: dto.tipoMeta, valorMeta: dto.valorMeta },
    });
    return paraDto(meta);
  }

  async obterProgresso(
    vendedorId: string,
    periodicidade: TipoPeriodicidadeMeta,
    periodo: string,
  ): Promise<MetaProgressoDto> {
    this.validarPeriodo(periodicidade, periodo);

    const meta = await this.prisma.metaVendedor.findUnique({
      where: { vendedorId_periodicidade_periodo: { vendedorId, periodicidade, periodo } },
    });

    const valorVendido = meta
      ? await this.calcularValorVendido(vendedorId, periodicidade, periodo, meta.tipoMeta)
      : 0;
    const valorMeta = meta ? meta.valorMeta.toNumber() : null;

    return {
      vendedorId,
      periodicidade,
      periodo,
      tipoMeta: meta?.tipoMeta ?? null,
      valorMeta,
      valorVendido,
      // MARGEM sem calculo ainda (ver comentario da classe) - fica sempre
      // null, mesmo com valorMeta configurado.
      percentualAtingido:
        meta?.tipoMeta !== 'MARGEM' && valorMeta && valorMeta > 0
          ? (valorVendido / valorMeta) * 100
          : null,
    };
  }

  private async calcularValorVendido(
    vendedorId: string,
    periodicidade: TipoPeriodicidadeMeta,
    periodo: string,
    tipoMeta: TipoMeta,
  ): Promise<number> {
    if (tipoMeta === 'MARGEM') {
      return 0;
    }
    const filtro = periodicidade === 'MENSAL' ? filtroMes(periodo) : filtroSemana(periodo);
    const porVendedor =
      tipoMeta === 'PESO'
        ? await this.vendedorVendasService.pesoVendidoPorVendedor(filtro)
        : await this.vendedorVendasService.valorVendidoPorVendedor(filtro);
    return porVendedor.get(vendedorId) ?? 0;
  }

  private validarPeriodo(periodicidade: TipoPeriodicidadeMeta, periodo: string): void {
    const formatoEsperado = periodicidade === 'MENSAL' ? REGEX_MES_ANO : REGEX_SEMANA_ISO;
    if (!formatoEsperado.test(periodo)) {
      throw new BadRequestException(
        periodicidade === 'MENSAL'
          ? `periodo '${periodo}' invalido pra periodicidade MENSAL - esperado YYYY-MM`
          : `periodo '${periodo}' invalido pra periodicidade SEMANAL - esperado YYYY-Www (semana ISO)`,
      );
    }
  }
}

function paraDto(meta: {
  vendedorId: string;
  periodicidade: TipoPeriodicidadeMeta;
  periodo: string;
  tipoMeta: TipoMeta;
  valorMeta: { toNumber(): number };
  atualizadoEm: Date;
}): MetaVendedorDto {
  return {
    vendedorId: meta.vendedorId,
    periodicidade: meta.periodicidade,
    periodo: meta.periodo,
    tipoMeta: meta.tipoMeta,
    valorMeta: meta.valorMeta.toNumber(),
    atualizadoEm: meta.atualizadoEm.toISOString(),
  };
}
