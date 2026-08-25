import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PapelVendedor } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface VendedorHierarquiaDto {
  id: string;
  nome: string | null;
  papel: PapelVendedor;
  supervisorId: string | null;
}

export interface AtualizarHierarquiaInput {
  papel?: PapelVendedor;
  supervisorId?: string | null;
}

// Hierarquia (OS-BACKEND-22) nao vem do WK Radar (ver skill
// wk-radar-client, secao "Vendedor") - configurada manualmente aqui pelo
// admin. Transporte simples (achar/validar/gravar), sem decisao de
// negocio com multiplos cenarios que mude com frequencia - por isso nao
// tem entidade de dominio propria (ver skill nestjs, "DDD so onde ha
// regra de negocio real"); a UNICA regra (evitar ciclo na cadeia de
// supervisorId) e' validacao estrutural, nao regra de negocio.
@Injectable()
export class VendedoresHierarquiaService {
  constructor(private readonly prisma: PrismaService) {}

  async atualizar(
    vendedorId: string,
    input: AtualizarHierarquiaInput,
  ): Promise<VendedorHierarquiaDto> {
    const vendedor = await this.prisma.vendedor.findUnique({
      where: { id: vendedorId },
    });
    if (!vendedor) {
      throw new NotFoundException(`Vendedor ${vendedorId} nao encontrado`);
    }

    if (input.supervisorId !== undefined && input.supervisorId !== null) {
      await this.validarSupervisor(vendedorId, input.supervisorId);
    }

    const atualizado = await this.prisma.vendedor.update({
      where: { id: vendedorId },
      data: {
        papel: input.papel,
        supervisorId: input.supervisorId,
      },
    });

    return {
      id: atualizado.id,
      nome: atualizado.nome,
      papel: atualizado.papel,
      supervisorId: atualizado.supervisorId,
    };
  }

  private async validarSupervisor(
    vendedorId: string,
    supervisorId: string,
  ): Promise<void> {
    if (supervisorId === vendedorId) {
      throw new BadRequestException('Um vendedor nao pode ser supervisor de si mesmo');
    }

    const supervisor = await this.prisma.vendedor.findUnique({
      where: { id: supervisorId },
      select: { id: true },
    });
    if (!supervisor) {
      throw new NotFoundException(`Supervisor ${supervisorId} nao encontrado`);
    }

    // Sobe a cadeia supervisorId a partir do supervisor PROPOSTO - se
    // chegar de volta em vendedorId, o vinculo criaria um ciclo (ex: A
    // supervisiona B, tentando fazer B supervisionar A).
    let atualId: string | null = supervisorId;
    const visitados = new Set<string>();
    while (atualId) {
      if (atualId === vendedorId) {
        throw new BadRequestException(
          'supervisorId criaria um ciclo na hierarquia',
        );
      }
      if (visitados.has(atualId)) {
        break;
      }
      visitados.add(atualId);
      const atual: { supervisorId: string | null } | null =
        await this.prisma.vendedor.findUnique({
          where: { id: atualId },
          select: { supervisorId: true },
        });
      atualId = atual?.supervisorId ?? null;
    }
  }
}
