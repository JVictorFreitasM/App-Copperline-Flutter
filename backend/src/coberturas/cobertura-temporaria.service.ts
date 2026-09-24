import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CriarCoberturaDto } from './dto/criar-cobertura.dto';

export interface CoberturaTemporariaDto {
  id: string;
  vendedorOriginalId: string;
  vendedorOriginalNome: string | null;
  vendedorSubstitutoId: string;
  vendedorSubstitutoNome: string | null;
  dataInicio: string;
  dataFim: string;
  ativa: boolean;
}

// OS-BACKEND-48 - CRUD minimo (so criar/listar) de admin, protegido por
// ApiKeyGuard (ver admin-coberturas.controller.ts) - mesmo criterio de
// hierarquia/meta (nao vem do Radar, configuracao manual). O FIM da
// cobertura e' so' a passagem de dataFim (ver VendedorEscopoService) -
// nenhum estado pra "encerrar" aqui, so' o registro historico.
@Injectable()
export class CoberturaTemporariaService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CriarCoberturaDto): Promise<CoberturaTemporariaDto> {
    if (dto.vendedorOriginalId === dto.vendedorSubstitutoId) {
      throw new BadRequestException(
        'Vendedor original e substituto não podem ser o mesmo',
      );
    }
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);
    if (dataFim <= dataInicio) {
      throw new BadRequestException('dataFim deve ser posterior a dataInicio');
    }

    const [original, substituto] = await Promise.all([
      this.prisma.vendedor.findUnique({ where: { id: dto.vendedorOriginalId } }),
      this.prisma.vendedor.findUnique({ where: { id: dto.vendedorSubstitutoId } }),
    ]);
    if (!original) {
      throw new NotFoundException(
        `Vendedor original '${dto.vendedorOriginalId}' não encontrado`,
      );
    }
    if (!substituto) {
      throw new NotFoundException(
        `Vendedor substituto '${dto.vendedorSubstitutoId}' não encontrado`,
      );
    }

    const criada = await this.prisma.coberturaTemporaria.create({
      data: {
        vendedorOriginalId: dto.vendedorOriginalId,
        vendedorSubstitutoId: dto.vendedorSubstitutoId,
        dataInicio,
        dataFim,
      },
    });

    return paraDto(criada, original.nome, substituto.nome);
  }

  async listar(): Promise<CoberturaTemporariaDto[]> {
    const coberturas = await this.prisma.coberturaTemporaria.findMany({
      orderBy: { dataInicio: 'desc' },
      include: {
        vendedorOriginal: { select: { nome: true } },
        vendedorSubstituto: { select: { nome: true } },
      },
    });
    return coberturas.map((c) =>
      paraDto(c, c.vendedorOriginal.nome, c.vendedorSubstituto.nome),
    );
  }

  // GET /coberturas/minha-ativa - so' existe GET /admin/coberturas (lista
  // TUDO, ApiKeyGuard) e GET /coberturas/:id/resumo (precisa ja saber o
  // id); sem isso o substituto nao tinha como DESCOBRIR o id da propria
  // cobertura ativa pra abrir o resumo de handoff. "Ativa" = dataInicio <=
  // agora <= dataFim (mesmo criterio de `ativa` em CoberturaTemporariaDto);
  // se houver mais de uma sobreposta (nao deveria, mas o schema nao
  // impede), pega a de inicio mais recente.
  async obterAtivaParaSubstituto(
    usuarioId: string,
  ): Promise<CoberturaTemporariaDto | null> {
    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
      select: { id: true },
    });
    if (!vendedor) {
      return null;
    }

    const agora = new Date();
    const cobertura = await this.prisma.coberturaTemporaria.findFirst({
      where: {
        vendedorSubstitutoId: vendedor.id,
        dataInicio: { lte: agora },
        dataFim: { gte: agora },
      },
      orderBy: { dataInicio: 'desc' },
      include: {
        vendedorOriginal: { select: { nome: true } },
        vendedorSubstituto: { select: { nome: true } },
      },
    });
    if (!cobertura) {
      return null;
    }
    return paraDto(cobertura, cobertura.vendedorOriginal.nome, cobertura.vendedorSubstituto.nome);
  }
}

function paraDto(
  cobertura: {
    id: string;
    vendedorOriginalId: string;
    vendedorSubstitutoId: string;
    dataInicio: Date;
    dataFim: Date;
  },
  vendedorOriginalNome: string | null,
  vendedorSubstitutoNome: string | null,
): CoberturaTemporariaDto {
  const agora = new Date();
  return {
    id: cobertura.id,
    vendedorOriginalId: cobertura.vendedorOriginalId,
    vendedorOriginalNome,
    vendedorSubstitutoId: cobertura.vendedorSubstitutoId,
    vendedorSubstitutoNome,
    dataInicio: cobertura.dataInicio.toISOString(),
    dataFim: cobertura.dataFim.toISOString(),
    ativa: cobertura.dataInicio <= agora && agora <= cobertura.dataFim,
  };
}
