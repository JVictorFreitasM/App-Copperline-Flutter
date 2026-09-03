import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorVendasService } from '../vendedores/vendedor-vendas.service';
import type { DefinirMetaVendedorDto } from './dto/definir-meta-vendedor.dto';
import { filtroMes } from './filtro-mes';

export interface MetaVendedorDto {
  vendedorId: string;
  mesAno: string;
  valorMeta: number;
  atualizadoEm: string;
}

export interface MetaProgressoDto {
  vendedorId: string;
  mesAno: string;
  // null = sem meta configurada pra esse mes (nao e' "meta zero") -
  // percentualAtingido tambem fica null nesse caso, nunca uma divisao por
  // zero disfarcada de 0%/100%.
  valorMeta: number | null;
  valorVendido: number;
  percentualAtingido: number | null;
}

// OS-BACKEND-44 - meta mensal configurada pelo admin/supervisor
// (definir()) e progresso calculado a partir de Pedido ja sincronizado
// (obterProgresso(), via VendedorVendasService - mesma atribuicao por
// vinculo Cliente-Vendedor do ranking do painel web).
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

    const meta = await this.prisma.metaVendedor.upsert({
      where: { vendedorId_mesAno: { vendedorId, mesAno: dto.mesAno } },
      create: { vendedorId, mesAno: dto.mesAno, valorMeta: dto.valorMeta },
      update: { valorMeta: dto.valorMeta },
    });
    return paraDto(meta);
  }

  async obterProgresso(
    vendedorId: string,
    mesAno: string,
  ): Promise<MetaProgressoDto> {
    const [meta, valoresPorVendedor] = await Promise.all([
      this.prisma.metaVendedor.findUnique({
        where: { vendedorId_mesAno: { vendedorId, mesAno } },
      }),
      this.vendedorVendasService.valorVendidoPorVendedor(filtroMes(mesAno)),
    ]);

    const valorVendido = valoresPorVendedor.get(vendedorId) ?? 0;
    const valorMeta = meta ? meta.valorMeta.toNumber() : null;

    return {
      vendedorId,
      mesAno,
      valorMeta,
      valorVendido,
      percentualAtingido:
        valorMeta && valorMeta > 0 ? (valorVendido / valorMeta) * 100 : null,
    };
  }
}

function paraDto(meta: {
  vendedorId: string;
  mesAno: string;
  valorMeta: { toNumber(): number };
  atualizadoEm: Date;
}): MetaVendedorDto {
  return {
    vendedorId: meta.vendedorId,
    mesAno: meta.mesAno,
    valorMeta: meta.valorMeta.toNumber(),
    atualizadoEm: meta.atualizadoEm.toISOString(),
  };
}
