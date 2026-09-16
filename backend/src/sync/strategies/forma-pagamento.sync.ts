import { Injectable, Logger } from '@nestjs/common';
import { ErpClientService } from '../../erp-client/erp-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { contagemSuspeitaDeTruncamento } from '../paginacao-por-janela';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';
import type {
  FormaPagamentoMapeada,
  WkRadarFormaPagamento,
} from './forma-pagamento.types';

const ROTA_FORMA_PAGAMENTO = '/empresarial/v1/forma-pagamento';

const CAMPOS_FORMA_PAGAMENTO = ['id', 'codigoIntegrador', 'codigo', 'descricao', 'inativa'];

// Preparacao pro envio de pedido ao ERP (POST /comercial/v1/pedido,
// faturamento.parcelas[].idFormaPagamento) - ver OS-pendentes-claude-code.md.
// Mesmo padrao estrutural de VendedorSyncStrategy: endpoint sem filtro de
// "alterado desde" (so Codigo/Situacao/MeioPagamento/Ids), catalogo pequeno
// (~17 registros) - full refresh diario, fetch() ignora `janela`. Busca
// Situacao=Todos (nao so Ativos) pra capturar tambem quando uma forma
// muda de ativa->inativa entre execucoes - filtro de "so as ativas" fica
// no service de leitura (PagamentoService), nao aqui.
@Injectable()
export class FormaPagamentoSyncStrategy implements SyncStrategy<
  WkRadarFormaPagamento,
  FormaPagamentoMapeada
> {
  readonly nomeEntidade = 'forma-pagamento';
  readonly agendamento = 'JANELA_FIXA_DIARIA' as const;
  private readonly logger = new Logger(FormaPagamentoSyncStrategy.name);

  constructor(
    private readonly erpClient: ErpClientService,
    private readonly prisma: PrismaService,
  ) {}

  async fetch(
    _janela: SyncWindow,
  ): Promise<SyncFetchResultado<WkRadarFormaPagamento>> {
    const registros = await this.erpClient.get<WkRadarFormaPagamento[]>(
      ROTA_FORMA_PAGAMENTO,
      { Situacao: 'Todos', Fields: CAMPOS_FORMA_PAGAMENTO },
    );

    const avisos: string[] = [];
    if (contagemSuspeitaDeTruncamento(registros.length)) {
      avisos.push(
        `Busca de formas de pagamento retornou exatamente ${registros.length} registro(s) - suspeita de truncamento silencioso nao documentado pela API`,
      );
    }

    return { registros, avisos };
  }

  map(bruto: WkRadarFormaPagamento): FormaPagamentoMapeada {
    return {
      idExternoErp: bruto.id,
      codigo: bruto.codigo ?? null,
      descricao: bruto.descricao ?? null,
      inativa: bruto.inativa,
    };
  }

  async upsert(mapeado: FormaPagamentoMapeada): Promise<void> {
    const campos = {
      codigo: mapeado.codigo,
      descricao: mapeado.descricao,
      inativa: mapeado.inativa,
      sincronizadoEm: new Date(),
    };

    await this.prisma.formaPagamento.upsert({
      where: { idExternoErp: mapeado.idExternoErp },
      create: { idExternoErp: mapeado.idExternoErp, ...campos },
      update: campos,
    });
  }
}
