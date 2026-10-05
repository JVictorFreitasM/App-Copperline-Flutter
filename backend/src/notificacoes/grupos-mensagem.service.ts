import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SalvarGrupoMensagemDto } from './dto/salvar-grupo-mensagem.dto';

export interface GrupoMensagemDto {
  id: string;
  nome: string;
  vendedorIds: string[];
}

// Grupos de destinatarios das mensagens manuais - lista nomeada de
// vendedores, independente da hierarquia supervisor->vendedor. CRUD raso,
// sem regra de negocio.
@Injectable()
export class GruposMensagemService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<GrupoMensagemDto[]> {
    const grupos = await this.prisma.grupoMensagem.findMany({
      orderBy: { nome: 'asc' },
      include: { membros: { select: { vendedorId: true } } },
    });
    return grupos.map(paraDto);
  }

  async criar(dto: SalvarGrupoMensagemDto): Promise<GrupoMensagemDto> {
    await this.garantirNomeLivre(dto.nome);
    await this.garantirVendedoresExistem(dto.vendedorIds);

    const grupo = await this.prisma.grupoMensagem.create({
      data: {
        nome: dto.nome,
        membros: { create: dto.vendedorIds.map((vendedorId) => ({ vendedorId })) },
      },
      include: { membros: { select: { vendedorId: true } } },
    });
    return paraDto(grupo);
  }

  async atualizar(id: string, dto: SalvarGrupoMensagemDto): Promise<GrupoMensagemDto> {
    const existente = await this.prisma.grupoMensagem.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException(`Grupo '${id}' não encontrado`);
    }
    await this.garantirNomeLivre(dto.nome, id);
    await this.garantirVendedoresExistem(dto.vendedorIds);

    const [, grupo] = await this.prisma.$transaction([
      this.prisma.grupoMensagemMembro.deleteMany({ where: { grupoId: id } }),
      this.prisma.grupoMensagem.update({
        where: { id },
        data: {
          nome: dto.nome,
          membros: { create: dto.vendedorIds.map((vendedorId) => ({ vendedorId })) },
        },
        include: { membros: { select: { vendedorId: true } } },
      }),
    ]);
    return paraDto(grupo);
  }

  async remover(id: string): Promise<void> {
    const existente = await this.prisma.grupoMensagem.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException(`Grupo '${id}' não encontrado`);
    }
    // Mensagens ja enviadas ficam (grupoId vira null, historico mostra
    // "Grupo removido") - o envio ja foi resolvido, nada depende do grupo.
    await this.prisma.grupoMensagem.delete({ where: { id } });
  }

  private async garantirNomeLivre(nome: string, ignorarId?: string): Promise<void> {
    const outro = await this.prisma.grupoMensagem.findUnique({ where: { nome } });
    if (outro && outro.id !== ignorarId) {
      throw new ConflictException(`Já existe um grupo chamado '${nome}'`);
    }
  }

  private async garantirVendedoresExistem(vendedorIds: string[]): Promise<void> {
    if (vendedorIds.length === 0) return;
    const encontrados = await this.prisma.vendedor.count({ where: { id: { in: vendedorIds } } });
    if (encontrados !== vendedorIds.length) {
      throw new UnprocessableEntityException('Algum vendedor informado não existe');
    }
  }
}

function paraDto(grupo: {
  id: string;
  nome: string;
  membros: { vendedorId: string }[];
}): GrupoMensagemDto {
  return {
    id: grupo.id,
    nome: grupo.nome,
    vendedorIds: grupo.membros.map((membro) => membro.vendedorId),
  };
}
