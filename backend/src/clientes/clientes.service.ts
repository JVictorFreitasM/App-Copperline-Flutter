import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraClienteDetalheDto,
  paraClienteResumoDto,
  type ClienteDetalheDto,
  type ClienteResumoDto,
} from './dto/cliente-response.dto';
import type { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';

// So leitura sobre dado ja sincronizado do WK Radar (OS 05) - sem regra de
// negocio, entao sem entidade de dominio separada (ver skill nest-endpoint,
// criterio de DDD).
@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarClientesQueryDto,
  ): Promise<PaginatedResult<ClienteResumoDto>> {
    const where: Prisma.ClienteWhereInput = {
      ...(query.nome && {
        OR: [
          { razaoSocial: { contains: query.nome, mode: 'insensitive' } },
          { nomeFantasia: { contains: query.nome, mode: 'insensitive' } },
        ],
      }),
      ...(query.cpfCnpj && { cpfCnpj: { contains: query.cpfCnpj } }),
    };

    const [clientes, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { razaoSocial: 'asc' },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return paginar(
      clientes.map(paraClienteResumoDto),
      total,
      query.page,
      query.limit,
    );
  }

  async buscarPorId(id: string): Promise<ClienteDetalheDto> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: { contatos: true },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente '${id}' não encontrado`);
    }

    return paraClienteDetalheDto(cliente);
  }
}
