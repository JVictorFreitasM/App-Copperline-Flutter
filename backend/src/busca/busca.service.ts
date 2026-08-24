import { Injectable } from '@nestjs/common';
import { paraClienteResumoDto } from '../clientes/dto/cliente-response.dto';
import { paraPedidoResumoDto } from '../pedidos/dto/pedido-response.dto';
import { paraProdutoResumoDto } from '../produtos/dto/produto-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { BuscaResultadoDto } from './dto/busca-resultado.dto';

// Numero de resultados por TIPO (nao no total) - cada um dos 3 findMany
// abaixo tem seu proprio `take`, senao um termo generico que so bate em
// cliente esconderia produto/pedido que tambem bateriam.
const LIMITE_POR_TIPO = 5;

// Busca simples via ILIKE/indice de texto padrao do Postgres (`contains` +
// `mode: 'insensitive'` do Prisma - mesmo padrao ja usado nos filtros de
// clientes/produtos/pedidos, ver ClientesService/ProdutosService). Sem
// motor de busca dedicado nesta fase (fora de escopo, ver OS) - so leitura
// sobre dado ja sincronizado, sem regra de negocio, sem entidade de
// dominio (ver skill nest-endpoint, criterio de DDD).
@Injectable()
export class BuscaService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(termo: string): Promise<BuscaResultadoDto> {
    const [clientes, produtos, pedidos] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where: {
          OR: [
            { razaoSocial: { contains: termo, mode: 'insensitive' } },
            { nomeFantasia: { contains: termo, mode: 'insensitive' } },
            { cpfCnpj: { contains: termo } },
          ],
        },
        take: LIMITE_POR_TIPO,
      }),
      this.prisma.produto.findMany({
        where: {
          OR: [
            { nome: { contains: termo, mode: 'insensitive' } },
            { codigo: { contains: termo, mode: 'insensitive' } },
            { gtin: { contains: termo, mode: 'insensitive' } },
          ],
        },
        take: LIMITE_POR_TIPO,
      }),
      this.prisma.pedido.findMany({
        where: { numero: { contains: termo, mode: 'insensitive' } },
        take: LIMITE_POR_TIPO,
        include: { cliente: true },
      }),
    ]);

    return {
      clientes: clientes.map(paraClienteResumoDto),
      produtos: produtos.map(paraProdutoResumoDto),
      pedidos: pedidos.map(paraPedidoResumoDto),
    };
  }
}
