import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';

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

// Painel de rastreio de equipe (OS-WEB-24) - vendedor sem posicao recente
// nenhuma (nunca enviou lote, ou Vendedor sem Usuario vinculado) fica de
// fora da lista, nao aparece com posicao nula (nao ha o que desenhar no
// mapa pra ele).
export interface PosicaoAtualVendedorDto {
  vendedorId: string;
  vendedorNome: string | null;
  latitude: number;
  longitude: number;
  capturadoEm: string;
}

// So captacao/consulta (OS-BACKEND-27) - sem regra de negocio real (nenhum
// alerta/geofencing, ver "Fora de escopo" da OS), entao sem entidade de
// dominio separada (ver skill nest-endpoint, criterio de DDD).
@Injectable()
export class RastreioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendedorEscopoService: VendedorEscopoService,
  ) {}

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

  // Ultima posicao por vendedor da EQUIPE de quem chama (OS-WEB-24) -
  // mesma resolucao de papel/equipe de VendedorEscopoService (ver seu
  // comentario sobre reuso alem de Cliente/SolicitacaoDesconto): SUPERVISOR/
  // GERENTE ve a propria equipe recursiva, admin ve todos os vendedores,
  // VENDEDOR comum ou usuario sem Vendedor vinculado nao tem "equipe" pra
  // acompanhar no mapa - 403 (mesmo criterio de
  // SolicitacoesDescontoService.listarPendentes, nao lista vazia).
  async obterUltimasPosicoesEquipe(
    idpUser: IdpUser,
    usuarioId: string,
  ): Promise<PosicaoAtualVendedorDto[]> {
    const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
      idpUser,
      usuarioId,
    );

    if (escopo.tipo === 'NENHUM' || escopo.tipo === 'PROPRIO') {
      throw new ForbiddenException(
        'Usuario autenticado nao tem papel de supervisao (supervisor/gerente) - sem equipe para acompanhar no mapa',
      );
    }

    const vendedores = await this.prisma.vendedor.findMany({
      where: {
        usuarioId: { not: null },
        ...(escopo.tipo === 'EQUIPE' ? { id: { in: escopo.vendedorIds } } : {}),
      },
      select: { id: true, nome: true, usuarioId: true },
    });
    if (vendedores.length === 0) {
      return [];
    }

    // distinct: ['usuarioId'] + orderBy capturadoEm desc = a primeira linha
    // de cada usuarioId JA E a mais recente - Prisma resolve "ultimo
    // registro por grupo" numa unica query, sem N+1 nem reducao em JS.
    const usuarioIds = vendedores.map((v) => v.usuarioId as string);
    const ultimasLocalizacoes = await this.prisma.localizacaoUsuario.findMany({
      where: { usuarioId: { in: usuarioIds } },
      orderBy: { capturadoEm: 'desc' },
      distinct: ['usuarioId'],
    });
    const localizacaoPorUsuarioId = new Map(
      ultimasLocalizacoes.map((loc) => [loc.usuarioId, loc]),
    );

    return vendedores
      .map((vendedor) => {
        const localizacao = localizacaoPorUsuarioId.get(vendedor.usuarioId as string);
        if (!localizacao) {
          return null;
        }
        return {
          vendedorId: vendedor.id,
          vendedorNome: vendedor.nome,
          latitude: localizacao.latitude.toNumber(),
          longitude: localizacao.longitude.toNumber(),
          capturadoEm: localizacao.capturadoEm.toISOString(),
        };
      })
      .filter((posicao): posicao is PosicaoAtualVendedorDto => posicao !== null);
  }

  // Trajeto de UM vendedor da equipe, num dia (drill-down do painel ao
  // clicar num pin, OS-WEB-24) - mesma logica de consultarTrajeto, so com o
  // gate de escopo antes. Vendedor fora da equipe do chamador: 404, nao
  // 403 (criterio anti-IDOR ja usado em ClientesService/VisitasService -
  // nao confirma pra quem nao deveria que aquele vendedorId existe).
  async obterTrajetoEquipe(
    idpUser: IdpUser,
    usuarioId: string,
    vendedorId: string,
    data: string,
  ): Promise<TrajetoVendedorDto> {
    const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
      idpUser,
      usuarioId,
    );

    if (escopo.tipo === 'NENHUM' || escopo.tipo === 'PROPRIO') {
      throw new ForbiddenException(
        'Usuario autenticado nao tem papel de supervisao (supervisor/gerente) - sem equipe para acompanhar no mapa',
      );
    }
    if (escopo.tipo === 'EQUIPE' && !escopo.vendedorIds.includes(vendedorId)) {
      throw new NotFoundException(`Vendedor '${vendedorId}' não encontrado`);
    }

    return this.consultarTrajeto(vendedorId, data);
  }
}
