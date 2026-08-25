import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraClienteDetalheDto,
  paraClienteResumoDto,
  type ClienteDetalheDto,
  type ClienteResumoDto,
} from './dto/cliente-response.dto';
import type { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';

export interface ConflitoClienteDto {
  existe: boolean;
  vendedorResponsavel: string | null;
}

// So leitura sobre dado ja sincronizado do WK Radar (OS 05) - sem regra de
// negocio, entao sem entidade de dominio separada (ver skill nest-endpoint,
// criterio de DDD). Escopo por vendedor (OS-BACKEND-23) e' um filtro a
// mais no where, resolvido fora (VendedorEscopoService) - listar() so
// aplica o que recebe, nao decide quem ve o que.
@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarClientesQueryDto,
    escopo: EscopoClientes,
  ): Promise<PaginatedResult<ClienteResumoDto>> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    // NENHUM (usuario autenticado sem Vendedor vinculado, nao admin) -
    // fail-closed: lista vazia sem nem consultar o banco, em vez de
    // arriscar expor tudo por omissao de filtro.
    if (whereEscopo === null) {
      return paginar([], 0, query.page, query.limit);
    }

    const where: Prisma.ClienteWhereInput = {
      ...whereEscopo,
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

  // Mesmo escopo de listar() aplicado por id (criterio de aceite: "em
  // nenhum endpoint" um vendedor ve cliente de outro) - 404 tanto pra "nao
  // existe" quanto pra "existe mas fora do escopo", nunca 403, pra nao
  // confirmar pra quem nao deveria ver que o registro existe (IDOR, ver
  // skill security-review).
  async buscarPorId(
    id: string,
    escopo: EscopoClientes,
  ): Promise<ClienteDetalheDto> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Cliente '${id}' não encontrado`);
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id, ...whereEscopo },
      include: { contatos: true },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente '${id}' não encontrado`);
    }

    return paraClienteDetalheDto(cliente);
  }

  // Unica excecao ao escopo por vendedor (OS-BACKEND-23, criterio de
  // aceite): qualquer vendedor pode checar se um documento ja esta
  // cadastrado, independente de quem e' o responsavel - e' o proposito do
  // endpoint (evitar cadastro/prospeccao duplicada). NAO aplica
  // EscopoClientes aqui de proposito. Documento normalizado (so digitos)
  // pra nao depender de como o CPF/CNPJ foi digitado.
  async verificarConflito(documento: string): Promise<ConflitoClienteDto> {
    const documentoNormalizado = documento.replace(/\D/g, '');

    const cliente = await this.prisma.cliente.findFirst({
      where: { cpfCnpj: documentoNormalizado },
      select: {
        vendedores: {
          take: 1,
          orderBy: { criadoEm: 'asc' },
          select: { vendedor: { select: { nome: true } } },
        },
      },
    });

    if (!cliente) {
      return { existe: false, vendedorResponsavel: null };
    }

    return {
      existe: true,
      vendedorResponsavel: cliente.vendedores[0]?.vendedor.nome ?? null,
    };
  }
}
