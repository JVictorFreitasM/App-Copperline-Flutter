import { ForbiddenException, Injectable } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { paraClienteResumoDto, type ClienteResumoDto } from '../clientes/dto/cliente-response.dto';
import { paraPedidoResumoDto, type PedidoResumoDto } from '../pedidos/dto/pedido-response.dto';
import { paraProdutoResumoDto, type ProdutoResumoDto } from '../produtos/dto/produto-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  VendedorEscopoService,
} from '../vendedores/vendedor-escopo.service';

export interface MobileSnapshotDto {
  geradoEm: string;
  clientes: ClienteResumoDto[];
  produtos: ProdutoResumoDto[];
  pedidos: PedidoResumoDto[];
}

// Tetos de seguranca (nao paginacao real - decisao confirmada com o
// usuario: uma resposta so, comprimida via gzip, ver main.ts). Carteira
// de um vendedor e catalogo de produto tipicamente ficam bem abaixo
// disso; o teto so evita uma consulta descontrolada num cenario fora do
// esperado.
const LIMITE_CLIENTES = 5000;
const LIMITE_PRODUTOS = 20000;
const LIMITE_PEDIDOS_RECENTES = 200;

// "Nao e' exportar o banco inteiro" (texto da OS) - clientes seguem o
// MESMO escopo por vendedor de GET /clientes (OS-BACKEND-23,
// VendedorEscopoService); pedidos sao so os que o PROPRIO vendedor criou
// (Pedido.vendedorId, OS-BACKEND-25) - nao a carteira de clientes inteira,
// que pode incluir pedidos sincronizados do ERP sem relacao com este
// vendedor. Produtos NAO sao escopados (catalogo e' compartilhado, nenhum
// vendedor "possui" um produto).
@Injectable()
export class MobileSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendedorEscopoService: VendedorEscopoService,
  ) {}

  async obter(idpUser: IdpUser, usuarioId: string): Promise<MobileSnapshotDto> {
    const vendedor = await this.prisma.vendedor.findFirst({ where: { usuarioId } });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado - sem snapshot para gerar',
      );
    }

    const escopo = await this.vendedorEscopoService.resolverEscopoClientes(idpUser, usuarioId);
    const whereClientes = construirWhereClientePorEscopo(escopo);

    const [clientes, produtos, pedidos] = await Promise.all([
      whereClientes
        ? this.prisma.cliente.findMany({
            where: whereClientes,
            take: LIMITE_CLIENTES,
            orderBy: { razaoSocial: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.produto.findMany({
        where: { inativo: false },
        take: LIMITE_PRODUTOS,
        orderBy: { nome: 'asc' },
      }),
      this.prisma.pedido.findMany({
        where: { vendedorId: vendedor.id },
        take: LIMITE_PEDIDOS_RECENTES,
        orderBy: { sincronizadoEm: 'desc' },
        include: { cliente: true },
      }),
    ]);

    return {
      geradoEm: new Date().toISOString(),
      clientes: clientes.map(paraClienteResumoDto),
      produtos: produtos.map(paraProdutoResumoDto),
      pedidos: pedidos.map(paraPedidoResumoDto),
    };
  }
}
