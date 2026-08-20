import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, TipoProduto } from '../../../generated/prisma/client';
import { ErpClientService } from '../../erp-client/erp-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  contagemSuspeitaDeTruncamento,
  gerarSubJanelas,
} from '../paginacao-por-janela';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';
import type {
  ProdutoMapeado,
  TipoProdutoWkRadar,
  WkRadarProduto,
} from './produto.types';

// ErpClientService.baseUrl ja inclui {host}/wk.api/api (ver skill
// wk-radar-client, secao "Base de URL") - aqui so o sufixo do recurso.
const ROTA_PRODUTO = '/empresarial/v1/produto';

const CAMPOS_PRODUTO = [
  'id',
  'codigoIntegrador',
  'codigo',
  'nome',
  'descricao',
  'tipo',
  'inativo',
  'precoVenda',
  'idGrade1',
  'idGrade2',
  'idGrade3',
  'referenciasGrade',
  'complemento.gtin',
];

const MAPA_TIPO: Record<TipoProdutoWkRadar, TipoProduto> = {
  Invalido: 'INVALIDO',
  Classe: 'CLASSE',
  Proprio: 'PROPRIO',
  Terceiros: 'TERCEIROS',
  Kit: 'KIT',
};

// Volume de alteracao de produto pode ser diferente do de cliente (ex:
// reajuste de preco em lote) - tamanho de janela proprio, nao herdado do
// cliente.sync.ts, configuravel via WK_RADAR_JANELA_PRODUTO_MS.
const TAMANHO_JANELA_PADRAO_MS = 6 * 60 * 60 * 1000; // 6 horas

@Injectable()
export class ProdutoSyncStrategy implements SyncStrategy<
  WkRadarProduto,
  ProdutoMapeado
> {
  readonly nomeEntidade = 'produto';
  // Volume de itens alto o bastante pra disputar o limite de requisicoes
  // do WK Radar se rodasse a cada 30 min durante o expediente (ver
  // sync-strategy.interface.ts) - roda de madrugada, uma vez por dia.
  readonly agendamento = 'INCREMENTAL_NOTURNO' as const;
  private readonly tamanhoJanelaMs: number;

  constructor(
    private readonly erpClient: ErpClientService,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.tamanhoJanelaMs = Number(
      configService.get('WK_RADAR_JANELA_PRODUTO_MS') ??
        TAMANHO_JANELA_PADRAO_MS,
    );
  }

  async fetch(janela: SyncWindow): Promise<SyncFetchResultado<WkRadarProduto>> {
    const idsVistos = new Set<string>();
    const registros: WkRadarProduto[] = [];
    const avisos: string[] = [];

    for (const subJanela of gerarSubJanelas(janela, this.tamanhoJanelaMs)) {
      // Produto so tem cursor unico (DataHoraAlteracao) - ao contrario de
      // cliente, a API nao aceita um limite superior, entao cada chamada
      // retorna tudo desde subJanela.desde ate o momento real da chamada
      // (nao so ate subJanela.ate). Sub-janelas sucessivas se sobrepoem: a
      // janela mais antiga inclui os produtos que as janelas seguintes vao
      // retornar de novo. Deduplicamos por id pra nao reprocessar o mesmo
      // produto varias vezes no mesmo run (ver skill wk-radar-client,
      // secao "Paginacao" - limitacao inerente de recursos com cursor
      // unico, nao ha como reduzir o tamanho da resposta em si por essa
      // via; janelar aqui serve pra fatiar o PROCESSAMENTO/checkpoint, nao
      // o payload de rede).
      const pagina = await this.erpClient.get<WkRadarProduto[]>(ROTA_PRODUTO, {
        DataHoraAlteracao: formatarDataWkRadar(subJanela.desde),
        Fields: CAMPOS_PRODUTO,
      });

      if (contagemSuspeitaDeTruncamento(pagina.length)) {
        avisos.push(
          `Sub-janela a partir de ${subJanela.desde.toISOString()} retornou exatamente ${pagina.length} registro(s) - suspeita de truncamento silencioso nao documentado pela API`,
        );
      }

      for (const produto of pagina) {
        if (!idsVistos.has(produto.id)) {
          idsVistos.add(produto.id);
          registros.push(produto);
        }
      }
    }

    return { registros, avisos };
  }

  map(bruto: WkRadarProduto): ProdutoMapeado {
    return {
      idExternoErp: bruto.id,
      codigoIntegrador: bruto.codigoIntegrador ?? null,
      codigo: bruto.codigo ?? null,
      nome: bruto.nome ?? null,
      descricao: bruto.descricao ?? null,
      tipo: bruto.tipo ? MAPA_TIPO[bruto.tipo] : null,
      inativo: bruto.inativo,
      precoVenda: bruto.precoVenda ?? null,
      gtin: bruto.complemento?.gtin ?? null,
      idGrade1: bruto.idGrade1 ?? null,
      idGrade2: bruto.idGrade2 ?? null,
      idGrade3: bruto.idGrade3 ?? null,
      referenciasGrade: bruto.referenciasGrade ?? [],
    };
  }

  async upsert(mapeado: ProdutoMapeado): Promise<void> {
    const sincronizadoEm = new Date();
    const referenciasGrade =
      mapeado.referenciasGrade as unknown as Prisma.InputJsonValue;
    const tipo = mapeado.tipo as TipoProduto | null;

    // incompleto:false aqui tambem no update - "completa" um eventual stub
    // criado por PedidoSyncStrategy (OS 07) quando o produto de verdade
    // chega aqui.
    const campos = {
      codigoIntegrador: mapeado.codigoIntegrador,
      codigo: mapeado.codigo,
      nome: mapeado.nome,
      descricao: mapeado.descricao,
      tipo,
      inativo: mapeado.inativo,
      precoVenda: mapeado.precoVenda,
      gtin: mapeado.gtin,
      idGrade1: mapeado.idGrade1,
      idGrade2: mapeado.idGrade2,
      idGrade3: mapeado.idGrade3,
      referenciasGrade,
      incompleto: false,
      sincronizadoEm,
    };

    await this.prisma.produto.upsert({
      where: { idExternoErp: mapeado.idExternoErp },
      create: { idExternoErp: mapeado.idExternoErp, ...campos },
      update: campos,
    });
  }
}

// WK Radar aceita date-time sem milissegundos/timezone (ex:
// "2026-08-17T00:00:00") - confirmado contra o ambiente de testes.
function formatarDataWkRadar(data: Date): string {
  return data.toISOString().replace(/\.\d{3}Z$/, '');
}
