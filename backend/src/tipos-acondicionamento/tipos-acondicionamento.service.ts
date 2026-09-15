import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AtualizarTipoAcondicionamentoDto } from './dto/atualizar-tipo-acondicionamento.dto';
import type { CriarTipoAcondicionamentoDto } from './dto/criar-tipo-acondicionamento.dto';
import {
  paraTipoAcondicionamentoDto,
  type TipoAcondicionamentoDto,
} from './dto/tipo-acondicionamento-response.dto';

// Catalogo editavel pelo admin, sem regra de negocio (CRUD simples) - sem
// entidade de dominio separada (ver skill nest-endpoint, criterio de DDD).
@Injectable()
export class TiposAcondicionamentoService {
  constructor(private readonly prisma: PrismaService) {}

  // Leitura publica (GET /tipos-acondicionamento, requireAuth) so lista os
  // ativos - popula seletor no front, inativo nao deveria ser escolhivel
  // pra produto novo.
  async listarAtivos(): Promise<TipoAcondicionamentoDto[]> {
    const tipos = await this.prisma.tipoAcondicionamento.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
    return tipos.map(paraTipoAcondicionamentoDto);
  }

  // Leitura admin (GET /admin/tipos-acondicionamento) traz tambem os
  // inativos - precisa poder reativar/editar um que foi desativado.
  async listarTodos(): Promise<TipoAcondicionamentoDto[]> {
    const tipos = await this.prisma.tipoAcondicionamento.findMany({
      orderBy: { nome: 'asc' },
    });
    return tipos.map(paraTipoAcondicionamentoDto);
  }

  async criar(dto: CriarTipoAcondicionamentoDto): Promise<TipoAcondicionamentoDto> {
    const tipo = await this.prisma.tipoAcondicionamento.create({
      data: { nome: dto.nome, tamanhoPadrao: dto.tamanhoPadrao },
    });
    return paraTipoAcondicionamentoDto(tipo);
  }

  async atualizar(
    id: string,
    dto: AtualizarTipoAcondicionamentoDto,
  ): Promise<TipoAcondicionamentoDto> {
    await this.obterOuFalhar(id);
    const tipo = await this.prisma.tipoAcondicionamento.update({
      where: { id },
      data: { nome: dto.nome, ativo: dto.ativo, tamanhoPadrao: dto.tamanhoPadrao },
    });
    return paraTipoAcondicionamentoDto(tipo);
  }

  private async obterOuFalhar(id: string) {
    const tipo = await this.prisma.tipoAcondicionamento.findUnique({ where: { id } });
    if (!tipo) {
      throw new NotFoundException(`Tipo de acondicionamento '${id}' não encontrado`);
    }
    return tipo;
  }
}
