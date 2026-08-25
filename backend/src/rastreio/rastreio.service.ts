import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PontoRastreioInput {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface RegistrarLoteResultadoDto {
  loteId: string;
  quantidade: number;
}

export interface PontoTrajetoDto {
  latitude: number;
  longitude: number;
  capturadoEm: string;
}

export interface TrajetoVendedorDto {
  vendedorId: string;
  data: string;
  pontos: PontoTrajetoDto[];
}

// So captacao/consulta (OS-BACKEND-27) - sem regra de negocio real (nenhum
// alerta/geofencing, ver "Fora de escopo" da OS), entao sem entidade de
// dominio separada (ver skill nest-endpoint, criterio de DDD).
@Injectable()
export class RastreioService {
  constructor(private readonly prisma: PrismaService) {}

  // capturadoEm usa o timestamp do PONTO (enviado pelo dispositivo), nunca
  // Date.now() do servidor - e' o que garante o criterio de aceite (lote
  // enviado offline preserva o momento real da captura). recebidoEm (com
  // default now() no schema) e' o unico campo que reflete o momento do
  // envio em si, separado de proposito.
  async registrarLote(
    usuarioId: string,
    pontos: PontoRastreioInput[],
  ): Promise<RegistrarLoteResultadoDto> {
    const loteId = randomUUID();

    await this.prisma.localizacaoUsuario.createMany({
      data: pontos.map((ponto) => ({
        usuarioId,
        latitude: ponto.latitude,
        longitude: ponto.longitude,
        capturadoEm: new Date(ponto.timestamp),
        loteId,
      })),
    });

    return { loteId, quantidade: pontos.length };
  }

  async consultarTrajeto(
    vendedorId: string,
    data: string,
  ): Promise<TrajetoVendedorDto> {
    const vendedor = await this.prisma.vendedor.findUnique({
      where: { id: vendedorId },
      select: { usuarioId: true },
    });
    if (!vendedor) {
      throw new NotFoundException(`Vendedor '${vendedorId}' não encontrado`);
    }

    // Vendedor sem Usuario vinculado (OS-BACKEND-21, semCorrespondenciaUsuario)
    // nunca capturou nada com sessao propria - trajeto vazio, nao erro.
    if (!vendedor.usuarioId) {
      return { vendedorId, data, pontos: [] };
    }

    const inicio = new Date(`${data}T00:00:00.000Z`);
    const fim = new Date(`${data}T23:59:59.999Z`);

    const pontos = await this.prisma.localizacaoUsuario.findMany({
      where: {
        usuarioId: vendedor.usuarioId,
        capturadoEm: { gte: inicio, lte: fim },
      },
      orderBy: { capturadoEm: 'asc' },
      select: { latitude: true, longitude: true, capturadoEm: true },
    });

    return {
      vendedorId,
      data,
      pontos: pontos.map((ponto) => ({
        latitude: ponto.latitude.toNumber(),
        longitude: ponto.longitude.toNumber(),
        capturadoEm: ponto.capturadoEm.toISOString(),
      })),
    };
  }
}
