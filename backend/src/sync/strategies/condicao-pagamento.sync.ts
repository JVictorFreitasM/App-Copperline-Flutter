import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { ErpClientService } from '../../erp-client/erp-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { contagemSuspeitaDeTruncamento } from '../paginacao-por-janela';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';
import type {
  CondicaoPagamentoMapeada,
  WkRadarCondicaoPagamento,
} from './condicao-pagamento.types';

const ROTA_CONDICAO_PAGAMENTO = '/empresarial/v1/condicao-pagamento';

const CAMPOS_CONDICAO_PAGAMENTO = [
  'id',
  'codigoIntegrador',
  'codigo',
  'nome',
  'aVista',
  'comEntrada',
  'antecipada',
  'validade',
  'parcelas',
];

// Preparacao pro envio de pedido ao ERP (POST /comercial/v1/pedido,
// faturamento.idCondicaoPagamento) - ver OS-pendentes-claude-code.md.
// Modulos=ComercialECF (nao Compras) - so condicao usavel numa venda.
// Mesmo padrao estrutural de VendedorSyncStrategy/FormaPagamentoSyncStrategy:
// endpoint sem filtro de "alterado desde" - full refresh diario, fetch()
// ignora `janela`. Sem filtro de Situacao (o endpoint nao tem um - ver
// condicao-pagamento.types.ts) - sincroniza tudo que o Radar devolver,
// `validade` e' o unico sinal de vigencia, decidido no service de leitura.
@Injectable()
export class CondicaoPagamentoSyncStrategy implements SyncStrategy<
  WkRadarCondicaoPagamento,
  CondicaoPagamentoMapeada
> {
  readonly nomeEntidade = 'condicao-pagamento';
  readonly agendamento = 'JANELA_FIXA_DIARIA' as const;
  private readonly logger = new Logger(CondicaoPagamentoSyncStrategy.name);

  constructor(
    private readonly erpClient: ErpClientService,
    private readonly prisma: PrismaService,
  ) {}

  async fetch(
    _janela: SyncWindow,
  ): Promise<SyncFetchResultado<WkRadarCondicaoPagamento>> {
    const registros = await this.erpClient.get<WkRadarCondicaoPagamento[]>(
      ROTA_CONDICAO_PAGAMENTO,
      { Modulos: 'ComercialECF', Fields: CAMPOS_CONDICAO_PAGAMENTO },
    );

    const avisos: string[] = [];
    if (contagemSuspeitaDeTruncamento(registros.length)) {
      avisos.push(
        `Busca de condicoes de pagamento retornou exatamente ${registros.length} registro(s) - suspeita de truncamento silencioso nao documentado pela API`,
      );
    }

    return { registros, avisos };
  }

  map(bruto: WkRadarCondicaoPagamento): CondicaoPagamentoMapeada {
    return {
      idExternoErp: bruto.id,
      codigo: bruto.codigo ?? null,
      nome: bruto.nome ?? null,
      aVista: bruto.aVista,
      comEntrada: bruto.comEntrada,
      antecipada: bruto.antecipada,
      validade: parseDataBrSemHora(bruto.validade),
      parcelas: bruto.parcelas ?? [],
    };
  }

  async upsert(mapeado: CondicaoPagamentoMapeada): Promise<void> {
    const campos = {
      codigo: mapeado.codigo,
      nome: mapeado.nome,
      aVista: mapeado.aVista,
      comEntrada: mapeado.comEntrada,
      antecipada: mapeado.antecipada,
      validade: mapeado.validade,
      parcelas: mapeado.parcelas as unknown as Prisma.InputJsonValue,
      sincronizadoEm: new Date(),
    };

    await this.prisma.condicaoPagamento.upsert({
      where: { idExternoErp: mapeado.idExternoErp },
      create: { idExternoErp: mapeado.idExternoErp, ...campos },
      update: campos,
    });
  }
}

// "DD/MM/AAAA" sem hora (diferente de parseDataHoraBr em
// common/parse-data-br.ts, que exige "DD/MM/AAAA HH:mm") - fail-safe:
// formato inesperado vira null, nunca lanca (mesmo criterio de
// parseDataBrWkRadar em pedido.sync.ts).
function parseDataBrSemHora(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
}
