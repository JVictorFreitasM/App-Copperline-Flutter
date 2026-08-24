import { Injectable } from '@nestjs/common';
import { parseDecimalBr } from '../../common/parse-decimal-br';
import { EstoqueSvcClientService } from '../../estoque-svc-client/estoque-svc-client.service';
import type { SaldoProdutoBruto } from '../../estoque-svc-client/estoque-svc-client.types';
import { registrarEventoNotificacao } from '../../notificacoes/evento-notificacao.service';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';

export interface SaldoEstoqueMapeado {
  codigoProduto: string;
  quantidadeDisponivel: string;
}

// nomeEntidade = 'saldo_estoque' (underscore, nao hifen como
// 'nota-fiscal') - deliberado: sync.service.ts deriva a env var da carga
// inicial via `nomeEntidade.toUpperCase()`, que nao insere separador entre
// palavras. Com hifen isso viraria WK_RADAR_SALDO-ESTOQUE_DATA_INICIO_CARGA
// (hifen em nome de env var e' arriscado em muitos contextos de shell).
// Com underscore vira WK_RADAR_SALDO_ESTOQUE_DATA_INICIO_CARGA, limpo -
// mesmo que o valor nunca seja de fato usado (ver `fetch()` abaixo).
//
// IGNORA o cursor incremental (janela.desde), mesmo padrao ja usado por
// NotaFiscalSyncStrategy (ver sync-strategy.interface.ts) - confirmado
// empiricamente em 2026-08-21: BuscarSaldoProduto sem
// DataHoraBaseAlteracaoInicial/paginacao devolveu as 1539 linhas de
// Estoque Proprio numa unica chamada (~2s). Volume pequeno o bastante pra
// full refresh a cada execucao ser mais simples e mais confiavel do que
// depender de filtro incremental/paginacao nao confirmados como
// suportados por esta operacao - reavaliar se o catalogo crescer muito.
//
// agendamento='CONFIGURAVEL' (ver sync-strategy.interface.ts) - nenhum
// @Cron do SyncScheduler dispara isso; o agendamento de verdade vive em
// SyncConfigService (BullMQ Job Scheduler proprio, mesma fila/processor,
// ver OS-BACKEND-15). Continua registrada em SYNC_STRATEGIES normalmente
// (sync.module.ts) porque SyncService.executar() precisa encontra-la ali
// - so o SyncScheduler que a ignora, filtrando por este campo.
@Injectable()
export class SaldoEstoqueSyncStrategy
  implements SyncStrategy<SaldoProdutoBruto, SaldoEstoqueMapeado>
{
  readonly nomeEntidade = 'saldo_estoque';
  readonly agendamento = 'CONFIGURAVEL' as const;

  constructor(
    private readonly estoqueSvcClient: EstoqueSvcClientService,
    private readonly prisma: PrismaService,
  ) {}

  async fetch(
    _janela: SyncWindow,
  ): Promise<SyncFetchResultado<SaldoProdutoBruto>> {
    const registros = await this.estoqueSvcClient.buscarSaldoProduto();
    return { registros, avisos: [] };
  }

  map(bruto: SaldoProdutoBruto): SaldoEstoqueMapeado {
    return {
      codigoProduto: bruto.codigoProduto,
      quantidadeDisponivel: parseDecimalBr(bruto.quantidadeDisponivel),
    };
  }

  async upsert(mapeado: SaldoEstoqueMapeado): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Buscado ANTES do upsert - unico jeito de comparar "quantidade
      // anterior x nova" (OS-BACKEND-19: alerta de "produto reabastecido").
      const existente = await tx.saldoEstoque.findUnique({
        where: { codigoProduto: mapeado.codigoProduto },
        select: { quantidadeDisponivel: true },
      });

      const saldo = await tx.saldoEstoque.upsert({
        where: { codigoProduto: mapeado.codigoProduto },
        create: mapeado,
        update: { quantidadeDisponivel: mapeado.quantidadeDisponivel },
      });

      // `existente === null` (primeira vez que este codigo aparece em
      // SaldoEstoque) NAO conta como "saiu de zero" - mesmo criterio ja
      // aplicado em pedido/nota-fiscal (ver notificarSeSituacaoMudou em
      // pedido.sync.ts): e' o saldo aparecendo pela primeira vez, nao uma
      // mudanca que alguem devesse ser avisado.
      const saiuDeZero =
        existente !== null &&
        existente.quantidadeDisponivel.toNumber() <= 0 &&
        saldo.quantidadeDisponivel.toNumber() > 0;

      if (saiuDeZero) {
        // So notifica se ja existir Produto sincronizado com esse codigo -
        // sem produto local nao ha id pra registrar o favorito/referencia
        // contra (SaldoEstoque nao tem FK pra Produto, ver schema.prisma).
        const produto = await tx.produto.findFirst({
          where: { codigo: mapeado.codigoProduto },
          select: { id: true },
        });

        if (produto) {
          await registrarEventoNotificacao(tx, {
            tipo: 'PRODUTO_REABASTECIDO',
            referenciaId: produto.id,
            titulo: 'Produto reabastecido',
            corpo: `O produto ${mapeado.codigoProduto} voltou a ter saldo em estoque.`,
            dados: { produtoId: produto.id, codigoProduto: mapeado.codigoProduto },
          });
        }
      }
    });
  }
}
