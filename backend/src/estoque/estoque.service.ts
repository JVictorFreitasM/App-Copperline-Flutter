import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EstoqueConsultaDto } from './dto/estoque-response.dto';

// So leitura sobre dado ja sincronizado (validacao do produto + saldo, ver
// SaldoEstoqueSyncStrategy) - sem regra de negocio nossa, sem entidade de
// dominio (ver skill nest-endpoint, criterio de DDD). Ate a sincronizacao
// de saldo de estoque, este service consultava o WK BI (Executivo.svc) em
// tempo real a cada requisicao - trocado por leitura da tabela local
// (SaldoEstoque) pra eliminar a dependencia sincrona do servico legado a
// cada consulta do app comercial. A validacao de existencia do produto
// abaixo NAO mudou nesta troca (pedido explicito da OS de sync de saldo).
@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  async consultarPorIdentificador(
    identificador: string,
  ): Promise<EstoqueConsultaDto> {
    const produto = await this.prisma.produto.findFirst({
      where: {
        OR: [{ idExternoErp: identificador }, { codigo: identificador }],
      },
    });

    if (!produto) {
      throw new NotFoundException(`Produto '${identificador}' não encontrado`);
    }

    if (!produto.codigo) {
      // Caso raro: stub incompleto criado por PedidoSyncStrategy (OS 07)
      // ainda sem codigo real - Estoque.svc so identifica produto por
      // CodigoProduto, sem ele nao ha o que buscar.
      throw new NotFoundException(
        `Produto '${identificador}' ainda não possui código sincronizado`,
      );
    }

    const saldo = await this.prisma.saldoEstoque.findUnique({
      where: { codigoProduto: produto.codigo },
    });

    if (!saldo) {
      // Produto existe mas nunca teve saldo sincronizado (fora do filtro
      // Estoque Proprio, ou a sincronizacao ainda nao rodou pra ele) -
      // itens vazio, nao erro (mesmo contrato ja usado pra "sem saldo").
      return { produtoId: produto.id, codigo: produto.codigo, itens: [], atualizadoEm: null };
    }

    return {
      produtoId: produto.id,
      codigo: produto.codigo,
      itens: [
        {
          localCodigo: null,
          localNome: null,
          lote: null,
          fabricadoEm: null,
          quantidade: saldo.quantidadeDisponivel.toString(),
        },
      ],
      atualizadoEm: saldo.atualizadoEm.toISOString(),
    };
  }
}
