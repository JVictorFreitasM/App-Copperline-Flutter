import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';

// CRUD simples sobre a tabela de vinculo (sem regra de negocio real - a
// unica decisao, "1 tabela = fixa, 2+ = vendedor escolhe", vive no
// CONSUMIDOR do array retornado por listarPorCliente, nao aqui). Ver
// skill nest-endpoint, criterio de DDD.
@Injectable()
export class ClienteTabelaPrecoService {
  constructor(private readonly prisma: PrismaService) {}

  // Leitura ESCOPADA (GET /clientes/:id/tabelas-preco, vendedor comum) -
  // mesmo criterio anti-IDOR de ClienteEstatisticasService.obter: 404
  // tanto pra cliente inexistente quanto pra cliente fora do escopo de
  // quem esta autenticado, nunca 403.
  //
  // Fallback pra tabela NATIVA do Radar (achado em 2026-09-17,
  // Cliente.tabelaPrecoIdExterno, ver cliente.sync.ts) - so' entra em jogo
  // quando o admin NUNCA associou nenhuma tabela manualmente aqui
  // (associacoes.length === 0). Resolve o id externo pro `codigo` de
  // TabelaPreco na LEITURA (nunca grava/duplica) - se a tabela referenciada
  // ainda nao sincronizou, cai pro comportamento de sempre (array vazio,
  // consumidor usa o fallback global ConfiguracaoTabelaPreco).
  async listarPorCliente(clienteId: string, escopo: EscopoClientes): Promise<string[]> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, ...whereEscopo },
      select: { id: true, tabelaPrecoIdExterno: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const associacoes = await this.prisma.clienteTabelaPreco.findMany({
      where: { clienteId },
      select: { codigo: true },
      orderBy: { criadoEm: 'asc' },
    });
    if (associacoes.length > 0) {
      return associacoes.map((a) => a.codigo);
    }

    if (!cliente.tabelaPrecoIdExterno) {
      return [];
    }
    const tabelaNativa = await this.prisma.tabelaPreco.findUnique({
      where: { idExternoErp: cliente.tabelaPrecoIdExterno },
      select: { codigo: true },
    });
    return tabelaNativa ? [tabelaNativa.codigo] : [];
  }

  async associar(clienteId: string, codigo: string): Promise<void> {
    await this.obterClienteOuFalhar(clienteId);
    // upsert (nao create) - POST repetido com o mesmo codigo e' idempotente,
    // nao lanca erro de unique constraint violado.
    await this.prisma.clienteTabelaPreco.upsert({
      where: { clienteId_codigo: { clienteId, codigo } },
      create: { clienteId, codigo },
      update: {},
    });
  }

  async desassociar(clienteId: string, codigo: string): Promise<void> {
    await this.obterClienteOuFalhar(clienteId);
    await this.prisma.clienteTabelaPreco.deleteMany({
      where: { clienteId, codigo },
    });
  }

  private async obterClienteOuFalhar(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }
  }
}
