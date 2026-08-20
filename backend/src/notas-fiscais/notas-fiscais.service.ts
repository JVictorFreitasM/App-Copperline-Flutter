import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraNotaFiscalDto,
  type NotaFiscalDto,
} from './dto/nota-fiscal-response.dto';
import type { ListarNotasFiscaisQueryDto } from './dto/listar-notas-fiscais-query.dto';

// Sincronizacao (OS 09) so cobre os ultimos 60 dias (DataEmissaoInicial/
// Final, sem cursor de alteracao - ver nota-fiscal.sync.ts) - decisao ja
// tomada naquela OS, nao repetida/alterada aqui. Devolvida na resposta pra
// nao parecer que uma nota fiscal mais antiga "sumiu" (ver Nota importante
// da OS-BACKEND-13).
const AVISO_JANELA_SINCRONIZACAO =
  'Esta lista cobre somente notas fiscais emitidas nos últimos 60 dias (janela de sincronização vigente).';

export interface ListaNotasFiscaisDto extends PaginatedResult<NotaFiscalDto> {
  aviso: string;
}

const INCLUDE_PEDIDOS_COM_CLIENTE = {
  pedidos: { include: { pedido: { include: { cliente: true } } } },
} as const;

// So leitura sobre dado ja sincronizado do WK Radar (OS 09) - sem regra de
// negocio, entao sem entidade de dominio separada (ver skill nest-endpoint,
// criterio de DDD).
@Injectable()
export class NotasFiscaisService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarNotasFiscaisQueryDto,
  ): Promise<ListaNotasFiscaisDto> {
    const where: Prisma.NotaFiscalWhereInput = {
      ...(query.numero !== undefined && { numero: query.numero }),
      ...(query.tipo && { tipo: query.tipo }),
      ...(query.statusNfe && { statusNfe: query.statusNfe }),
      ...(query.clienteNome && {
        pedidos: {
          some: {
            pedido: {
              cliente: {
                OR: [
                  {
                    razaoSocial: {
                      contains: query.clienteNome,
                      mode: 'insensitive',
                    },
                  },
                  {
                    nomeFantasia: {
                      contains: query.clienteNome,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          },
        },
      }),
    };

    const [notas, total] = await this.prisma.$transaction([
      this.prisma.notaFiscal.findMany({
        where,
        include: INCLUDE_PEDIDOS_COM_CLIENTE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { dataEmissao: 'desc' },
      }),
      this.prisma.notaFiscal.count({ where }),
    ]);

    return {
      ...paginar(notas.map(paraNotaFiscalDto), total, query.page, query.limit),
      aviso: AVISO_JANELA_SINCRONIZACAO,
    };
  }

  async buscarPorId(id: string): Promise<NotaFiscalDto> {
    const nota = await this.prisma.notaFiscal.findUnique({
      where: { id },
      include: INCLUDE_PEDIDOS_COM_CLIENTE,
    });

    if (!nota) {
      throw new NotFoundException(`Nota fiscal '${id}' não encontrada`);
    }

    return paraNotaFiscalDto(nota);
  }
}
