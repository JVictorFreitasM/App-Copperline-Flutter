import { readFile } from 'node:fs/promises';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraNotaFiscalDto,
  type NotaFiscalDto,
} from './dto/nota-fiscal-response.dto';
import type { ListarNotasFiscaisQueryDto } from './dto/listar-notas-fiscais-query.dto';
import { resolverCaminhoPdfNotaFiscal } from './resolver-caminho-pdf-nota-fiscal';

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
  private readonly diretorioPdf: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.diretorioPdf = configService.getOrThrow<string>('NOTAS_FISCAIS_PDF_DIR');
  }

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

  // Le o PDF direto da pasta compartilhada da rede (NOTAS_FISCAIS_PDF_DIR,
  // ver skill/OS de associacao nota->PDF) - nunca copiado pro nosso disco,
  // so servido on-demand. Distingue os dois motivos de "sem PDF": nota sem
  // chave (NFS-e, fora de escopo - ver resolverCaminhoPdfNotaFiscal) vs.
  // chave presente mas arquivo ausente na pasta compartilhada (ainda nao
  // chegou lá, ou pasta de rede fora do ar) - mensagens diferentes ajudam
  // a diagnosticar qual dos dois casos é.
  async obterPdf(id: string): Promise<{ buffer: Buffer; nomeArquivo: string }> {
    const nota = await this.prisma.notaFiscal.findUnique({
      where: { id },
      select: { chave: true, dataEmissao: true, numero: true },
    });
    if (!nota) {
      throw new NotFoundException(`Nota fiscal '${id}' não encontrada`);
    }

    const caminho = resolverCaminhoPdfNotaFiscal(nota, this.diretorioPdf);
    if (!caminho) {
      throw new NotFoundException(
        `Nota fiscal '${id}' não tem chave de acesso de NF-e sincronizada - sem PDF pra resolver (NFS-e não é suportado ainda)`,
      );
    }

    try {
      const buffer = await readFile(caminho);
      return { buffer, nomeArquivo: `${nota.numero ?? id}-nfe.pdf` };
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException(
          `PDF da nota fiscal '${id}' não encontrado na pasta compartilhada (${caminho}) - verifique se o arquivo já foi gerado/copiado, ou se a pasta de rede está acessível`,
        );
      }
      throw erro;
    }
  }
}
