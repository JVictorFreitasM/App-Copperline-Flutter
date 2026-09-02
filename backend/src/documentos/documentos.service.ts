import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentoStorageService } from './documento-storage.service';
import { paraDocumentoDto, type DocumentoDto } from './dto/documento-response.dto';
import type { ListarDocumentosQueryDto } from './dto/listar-documentos-query.dto';
import type { UploadDocumentoDto } from './dto/upload-documento.dto';

// Whitelist explicita (segurança - checklist "5. XSS/input sem tratamento",
// "validação real de upload") - PDF, imagens e planilhas, nunca executável
// ou tipo arbitrário (critério de aceite explícito da OS-BACKEND-41).
export const TIPOS_MIME_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
] as const;

export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;

const INCLUDE_ENVIADO_POR = { enviadoPor: true } as const;

// Sem regra de negocio (CRUD raso sobre arquivo estatico) - sem entidade de
// dominio separada, mesmo criterio de NotasFiscaisService (ver skill
// nest-endpoint).
@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DocumentoStorageService,
  ) {}

  async listar(query: ListarDocumentosQueryDto): Promise<PaginatedResult<DocumentoDto>> {
    const where: Prisma.DocumentoWhereInput = {
      ...(query.categoria && { categoria: query.categoria }),
    };

    const [documentos, total] = await this.prisma.$transaction([
      this.prisma.documento.findMany({
        where,
        include: INCLUDE_ENVIADO_POR,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.documento.count({ where }),
    ]);

    return paginar(documentos.map(paraDocumentoDto), total, query.page, query.limit);
  }

  async criar(
    usuarioId: string,
    dto: UploadDocumentoDto,
    arquivo: Express.Multer.File,
  ): Promise<DocumentoDto> {
    if (!TIPOS_MIME_PERMITIDOS.includes(arquivo.mimetype as (typeof TIPOS_MIME_PERMITIDOS)[number])) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${arquivo.mimetype}. Tipos aceitos: PDF, imagem (JPEG/PNG) ou planilha (XLS/XLSX/CSV).`,
      );
    }

    const caminhoArquivo = await this.storage.salvar(arquivo.buffer, arquivo.originalname);

    const documento = await this.prisma.documento.create({
      data: {
        nome: dto.nome,
        categoria: dto.categoria,
        caminhoArquivo,
        tipoMime: arquivo.mimetype,
        tamanhoBytes: arquivo.size,
        enviadoPorId: usuarioId,
      },
      include: INCLUDE_ENVIADO_POR,
    });

    return paraDocumentoDto(documento);
  }

  async obterParaDownload(
    id: string,
  ): Promise<{ buffer: Buffer; nome: string; tipoMime: string }> {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) {
      throw new NotFoundException(`Documento '${id}' não encontrado`);
    }

    const buffer = await this.storage.ler(documento.caminhoArquivo);
    return { buffer, nome: documento.nome, tipoMime: documento.tipoMime };
  }
}
