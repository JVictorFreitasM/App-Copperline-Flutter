import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { filtroPeriodo } from '../dashboard/filtro-periodo';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import {
  paraRelatorioPedidoItemDto,
  type RelatorioPedidosDto,
  type RelatorioVendedorDto,
  type StatusAprovacaoPedido,
} from './dto/relatorio-pedidos-response.dto';

export interface RelatorioPedidosFiltro {
  vendedorId?: string;
  status?: StatusAprovacaoPedido;
  dataInicial?: string;
  dataFinal?: string;
}

// Relatorio diario de pedidos (OS-WEB-27) - NAO existe uma versao mobile
// pra estender (OS-BACKEND-31 nunca foi implementada, decisao confirmada
// com o usuario: construir direto sobre Pedido). "Pendente" e' definido
// pelo pipeline de aprovacao de desconto (SolicitacaoDesconto.status via
// pedido.solicitacoesDesconto), nao Pedido.statusLocal isolado - ver
// dto/relatorio-pedidos-response.dto.ts pra por que (statusLocal nunca e'
// atualizado apos a decisao).
@Injectable()
export class RelatorioPedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendedorEscopoService: VendedorEscopoService,
  ) {}

  async obter(
    idpUser: IdpUser,
    usuarioId: string,
    filtro: RelatorioPedidosFiltro,
  ): Promise<RelatorioPedidosDto> {
    const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
      idpUser,
      usuarioId,
    );

    if (escopo.tipo === 'NENHUM' || escopo.tipo === 'PROPRIO') {
      throw new ForbiddenException(
        'Usuario autenticado nao tem papel de supervisao (supervisor/gerente) - sem equipe para relatar',
      );
    }
    if (
      escopo.tipo === 'EQUIPE' &&
      filtro.vendedorId &&
      !escopo.vendedorIds.includes(filtro.vendedorId)
    ) {
      throw new NotFoundException(`Vendedor '${filtro.vendedorId}' não encontrado`);
    }

    const vendedorWhere = filtro.vendedorId
      ? { id: filtro.vendedorId }
      : escopo.tipo === 'EQUIPE'
        ? { id: { in: escopo.vendedorIds } }
        : {};

    const vendedores = await this.prisma.vendedor.findMany({
      where: vendedorWhere,
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    });

    // "Hoje" só quando NENHUM dos dois limites foi informado - se um dos
    // dois veio, respeita como intervalo aberto (mesmo criterio de
    // dashboard/pedidos), sem forçar o outro lado.
    const semPeriodoInformado = !filtro.dataInicial && !filtro.dataFinal;
    const hoje = new Date().toISOString().slice(0, 10);
    const dataInicialEfetiva = semPeriodoInformado ? hoje : filtro.dataInicial;
    const dataFinalEfetiva = semPeriodoInformado ? hoje : filtro.dataFinal;

    if (vendedores.length === 0) {
      return {
        periodo: {
          dataInicial: dataInicialEfetiva ?? null,
          dataFinal: dataFinalEfetiva ?? null,
        },
        vendedores: [],
      };
    }

    const vendedorIds = vendedores.map((v) => v.id);

    const [pedidos, pedidosAguardandoAprovacao] = await Promise.all([
      this.prisma.pedido.findMany({
        where: {
          vendedorId: { in: vendedorIds },
          dataHoraUltimaAlteracao: filtroPeriodo(dataInicialEfetiva, dataFinalEfetiva),
        },
        include: {
          cliente: true,
          solicitacoesDesconto: {
            select: { status: true },
            orderBy: { criadoEm: 'desc' },
            take: 1,
          },
        },
        orderBy: { dataHoraUltimaAlteracao: 'desc' },
      }),
      // Contagem de pendentes ATUAIS (backlog de aprovação), independente
      // do período filtrado acima - "útil pra identificar gargalo de
      // aprovação" é sobre o estado agora, não sobre o que aconteceu só
      // no período escolhido pra listagem.
      this.prisma.pedido.findMany({
        where: { vendedorId: { in: vendedorIds }, statusLocal: 'AGUARDANDO_APROVACAO' },
        select: {
          vendedorId: true,
          solicitacoesDesconto: {
            select: { status: true },
            orderBy: { criadoEm: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const pendentesPorVendedor = new Map<string, number>();
    for (const pedido of pedidosAguardandoAprovacao) {
      const statusAtual = pedido.solicitacoesDesconto[0]?.status ?? 'PENDENTE';
      if (statusAtual === 'PENDENTE' && pedido.vendedorId) {
        pendentesPorVendedor.set(
          pedido.vendedorId,
          (pendentesPorVendedor.get(pedido.vendedorId) ?? 0) + 1,
        );
      }
    }

    const agora = new Date();
    const itensPorVendedor = new Map<string, ReturnType<typeof paraRelatorioPedidoItemDto>[]>();
    for (const pedido of pedidos) {
      if (!pedido.vendedorId) continue;
      const item = paraRelatorioPedidoItemDto(pedido, agora);
      if (filtro.status && item.statusAprovacao !== filtro.status) {
        continue;
      }
      const lista = itensPorVendedor.get(pedido.vendedorId) ?? [];
      lista.push(item);
      itensPorVendedor.set(pedido.vendedorId, lista);
    }

    const vendedoresDto: RelatorioVendedorDto[] = vendedores.map((vendedor) => {
      const pedidosDoVendedor = itensPorVendedor.get(vendedor.id) ?? [];
      return {
        vendedorId: vendedor.id,
        vendedorNome: vendedor.nome,
        totalPedidos: pedidosDoVendedor.length,
        pendentesAtuais: pendentesPorVendedor.get(vendedor.id) ?? 0,
        pedidos: pedidosDoVendedor,
      };
    });

    return {
      periodo: { dataInicial: dataInicialEfetiva ?? null, dataFinal: dataFinalEfetiva ?? null },
      vendedores: vendedoresDto,
    };
  }
}
