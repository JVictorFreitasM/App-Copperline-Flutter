import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';
import { paginar, type PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { variantesParaBusca } from './domain/documento';
import {
  paraClienteDetalheDto,
  paraClienteResumoDto,
  paraContatoClienteDto,
  type ClienteDetalheDto,
  type ClienteResumoDto,
  type ContatoClienteDto,
} from './dto/cliente-response.dto';
import type { CriarContatoClienteDto } from './dto/criar-contato-cliente.dto';
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
      // 'com_pedido'/'sem_visita' (ajustes-layout-mobile, item 6) - "sem
      // visita" e' "nunca teve nenhuma Visita registrada", nao um recorte
      // por periodo (o app nao tem esse conceito de janela pra visita).
      ...(query.filtro === 'com_pedido' && { pedidos: { some: {} } }),
      ...(query.filtro === 'sem_visita' && { visitas: { none: {} } }),
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
      include: {
        contatos: true,
        alteracoesErp: {
          where: { status: { not: 'ENVIADO' } },
          orderBy: { criadoEm: 'desc' },
          take: 1,
          select: { status: true, erro: true, criadoEm: true },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente '${id}' não encontrado`);
    }

    return paraClienteDetalheDto(cliente);
  }

  // Contato criado por nos (nunca sincronizado do Radar, ver
  // ContatoCliente.criadoLocalmente no schema) - mesmo escopo por vendedor
  // de buscarPorId, pra nao deixar adicionar contato num cliente fora da
  // carteira de quem chama. idExternoErp sintetico ("LOCAL-<uuid>") so'
  // pra satisfazer a coluna @unique sem torna-la nullable - nunca colide
  // com um id real do Radar (que nao usa esse prefixo).
  async criarContato(
    clienteId: string,
    dto: CriarContatoClienteDto,
    escopo: EscopoClientes,
  ): Promise<ContatoClienteDto> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    const cliente = whereEscopo
      ? await this.prisma.cliente.findFirst({ where: { id: clienteId, ...whereEscopo } })
      : null;
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const contato = await this.prisma.contatoCliente.create({
      data: {
        idExternoErp: `LOCAL-${randomUUID()}`,
        clienteId,
        nome: dto.nome,
        telefoneDdd: dto.telefoneDdd ?? null,
        telefoneNumero: dto.telefoneNumero ?? null,
        email: dto.email ?? null,
        funcao: dto.funcao ?? null,
        criadoLocalmente: true,
        sincronizadoEm: new Date(),
      },
    });
    return paraContatoClienteDto(contato);
  }

  // Unica excecao ao escopo por vendedor (OS-BACKEND-23, criterio de
  // aceite): qualquer vendedor pode checar se um documento ja esta
  // cadastrado, independente de quem e' o responsavel - e' o proposito do
  // endpoint (evitar cadastro/prospeccao duplicada). NAO aplica
  // EscopoClientes aqui de proposito. Documento normalizado (so digitos)
  // pra nao depender de como o CPF/CNPJ foi digitado - e busca pelas DUAS formas
  // gravadas: o sync grava cpf_cnpj FORMATADO ("19.243.253/0001-14"), entao
  // comparar so com os digitos nunca achava ninguem.
  async verificarConflito(documento: string): Promise<ConflitoClienteDto> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { cpfCnpj: { in: variantesParaBusca(documento) } },
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
