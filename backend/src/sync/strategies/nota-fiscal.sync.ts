import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  StatusNfe,
  TipoNotaFiscal,
} from '../../../generated/prisma/client';
import { ErpClientService } from '../../erp-client/erp-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { buscarPorJanelas } from '../paginacao-por-janela';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';
import type {
  NotaFiscalMapeado,
  StatusNfeWkRadar,
  TipoNotaFiscalWkRadar,
  WkRadarNotaFiscal,
} from './nota-fiscal.types';

// ErpClientService.baseUrl ja inclui {host}/wk.api/api (ver skill
// wk-radar-client, secao "Base de URL") - aqui so o sufixo do recurso.
const ROTA_NOTA_FISCAL = '/comercial/v1/nota-fiscal';

const CAMPOS_NOTA_FISCAL = [
  'id',
  'codigoIntegrador',
  'chave',
  'tipo',
  'numero',
  'serie',
  'dataEmissao',
  'pedidos.id',
  'nfe.status',
  'nfse.nfseGerada',
  'nfse.nfseCancelada',
  'total.valorTotalNotaFiscal',
];

const MAPA_TIPO: Record<TipoNotaFiscalWkRadar, TipoNotaFiscal> = {
  Entrada: 'ENTRADA',
  Saida: 'SAIDA',
};

const MAPA_STATUS_NFE: Record<StatusNfeWkRadar, StatusNfe> = {
  ErroValidacao: 'ERRO_VALIDACAO',
  AguardandoAutorizacao: 'AGUARDANDO_AUTORIZACAO',
  Autorizada: 'AUTORIZADA',
  Denegada: 'DENEGADA',
  Rejeitada: 'REJEITADA',
  Cancelada: 'CANCELADA',
  Inutilizada: 'INUTILIZADA',
};

const DIAS_JANELA_RETROATIVA = 60;
const TAMANHO_SUB_JANELA_PADRAO_MS = 24 * 60 * 60 * 1000; // 1 dia

// ATENCAO - strategy estruturalmente diferente das outras (cliente/produto/
// pedido, OS 05-07): nota-fiscal so tem DataEmissaoInicial/Final (data de
// EMISSAO, nao de ALTERACAO - ver skill wk-radar-client, secao "Nota
// Fiscal"). Nao ha filtro de "alterado desde X", entao nao da pra fazer
// sync incremental de verdade: uma nota que mudar (ex: cancelamento) so e
// detectada reconsultando o periodo de novo.
//
// Por isso esta strategy declara `agendamento: 'JANELA_FIXA_DIARIA'` (roda
// uma vez por dia, de madrugada - ver SyncScheduler) e, dentro de fetch(),
// IGNORA deliberadamente `janela.desde` (o cursor incremental que o
// SyncService calcularia a partir de SyncEntity.ultimaSincronizacao) -
// sempre reprocessa os ultimos 60 dias inteiros, usando so `janela.ate`
// (o instante em que a execucao comecou) como referencia. Isso e uma troca
// deliberada: uma nota que mudar depois desses 60 dias nao e capturada -
// decisao aceita nesta OS, nao um bug a corrigir depois. O upsert por
// id_externo_erp garante que reprocessar o mesmo periodo todo dia so
// atualiza o que mudou, sem duplicar.
@Injectable()
export class NotaFiscalSyncStrategy implements SyncStrategy<
  WkRadarNotaFiscal,
  NotaFiscalMapeado
> {
  readonly nomeEntidade = 'nota-fiscal';
  readonly agendamento = 'JANELA_FIXA_DIARIA' as const;
  private readonly logger = new Logger(NotaFiscalSyncStrategy.name);
  private readonly tamanhoSubJanelaMs: number;

  constructor(
    private readonly erpClient: ErpClientService,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.tamanhoSubJanelaMs = Number(
      configService.get('WK_RADAR_JANELA_NOTA_FISCAL_MS') ??
        TAMANHO_SUB_JANELA_PADRAO_MS,
    );
  }

  async fetch(
    janela: SyncWindow,
  ): Promise<SyncFetchResultado<WkRadarNotaFiscal>> {
    const janelaRetroativaFixa: SyncWindow = {
      desde: new Date(
        janela.ate.getTime() - DIAS_JANELA_RETROATIVA * 24 * 60 * 60 * 1000,
      ),
      ate: janela.ate,
    };

    // Nota fiscal tem par de datas (DataEmissaoInicial/Final) - cada
    // sub-janela vira uma chamada com intervalo fechado, reduzindo de fato
    // o volume por resposta (mesmo padrao de cliente.sync.ts, ver skill
    // wk-radar-client, secao "Paginacao").
    return buscarPorJanelas(
      janelaRetroativaFixa,
      this.tamanhoSubJanelaMs,
      (subJanela) =>
        this.erpClient.get<WkRadarNotaFiscal[]>(ROTA_NOTA_FISCAL, {
          // DataEmissaoInicial/Final sao "date", nao "date-time" (unico
          // par de datas nesse formato entre os recursos ja sincronizados
          // - confirmado contra o ambiente de testes: um datetime completo
          // volta 400 "data invalida").
          DataEmissaoInicial: formatarDataWkRadarSemHora(subJanela.desde),
          DataEmissaoFinal: formatarDataWkRadarSemHora(subJanela.ate),
          Fields: CAMPOS_NOTA_FISCAL,
        }),
    );
  }

  map(bruto: WkRadarNotaFiscal): NotaFiscalMapeado {
    return {
      idExternoErp: bruto.id,
      codigoIntegrador: bruto.codigoIntegrador ?? null,
      chave: bruto.chave ?? null,
      tipo: bruto.tipo ? MAPA_TIPO[bruto.tipo] : null,
      numero: bruto.numero ?? null,
      serie: bruto.serie ?? null,
      dataEmissao: bruto.dataEmissao ? new Date(bruto.dataEmissao) : null,
      statusNfe: bruto.nfe?.status ? MAPA_STATUS_NFE[bruto.nfe.status] : null,
      nfseGerada: bruto.nfse?.nfseGerada ?? null,
      nfseCancelada: bruto.nfse?.nfseCancelada ?? null,
      valorTotalNotaFiscal: bruto.total?.valorTotalNotaFiscal ?? null,
      pedidosExternoIds: (bruto.pedidos ?? [])
        .map((pedido) => pedido.id)
        .filter((id): id is string => Boolean(id)),
    };
  }

  async upsert(mapeado: NotaFiscalMapeado): Promise<void> {
    const sincronizadoEm = new Date();

    await this.prisma.$transaction(async (tx) => {
      const notaFiscal = await tx.notaFiscal.upsert({
        where: { idExternoErp: mapeado.idExternoErp },
        create: {
          idExternoErp: mapeado.idExternoErp,
          codigoIntegrador: mapeado.codigoIntegrador,
          chave: mapeado.chave,
          tipo: mapeado.tipo as TipoNotaFiscal | null,
          numero: mapeado.numero,
          serie: mapeado.serie,
          dataEmissao: mapeado.dataEmissao,
          statusNfe: mapeado.statusNfe as StatusNfe | null,
          nfseGerada: mapeado.nfseGerada,
          nfseCancelada: mapeado.nfseCancelada,
          valorTotalNotaFiscal: mapeado.valorTotalNotaFiscal,
          sincronizadoEm,
        },
        update: {
          codigoIntegrador: mapeado.codigoIntegrador,
          chave: mapeado.chave,
          tipo: mapeado.tipo as TipoNotaFiscal | null,
          numero: mapeado.numero,
          serie: mapeado.serie,
          dataEmissao: mapeado.dataEmissao,
          statusNfe: mapeado.statusNfe as StatusNfe | null,
          nfseGerada: mapeado.nfseGerada,
          nfseCancelada: mapeado.nfseCancelada,
          valorTotalNotaFiscal: mapeado.valorTotalNotaFiscal,
          sincronizadoEm,
        },
      });

      // Vinculo N:N com pedido - a lista de pedidos de uma nota emitida
      // raramente muda, mas recriar do zero a cada sync e mais simples e
      // correto do que tentar diffar contra o estado anterior.
      await tx.notaFiscalPedido.deleteMany({
        where: { notaFiscalId: notaFiscal.id },
      });

      for (const idPedidoExterno of mapeado.pedidosExternoIds) {
        const pedidoId = await this.resolverOuCriarPedidoStub(
          tx,
          idPedidoExterno,
        );
        await tx.notaFiscalPedido.create({
          data: { notaFiscalId: notaFiscal.id, pedidoId },
        });
      }
    });
  }

  // Mesmo padrao ja usado por PedidoSyncStrategy pra cliente/produto (OS
  // 07): se a nota referenciar um pedido que este sistema ainda nao
  // sincronizou, cria um stub (incompleto=true, so id_externo_erp) em vez
  // de perder a nota fiscal. pedido.sync.ts completa os dados e zera
  // incompleto quando sincronizar esse pedido de verdade.
  private async resolverOuCriarPedidoStub(
    tx: PrismaTx,
    idExternoErp: string,
  ): Promise<string> {
    const pedido = await tx.pedido.upsert({
      where: { idExternoErp },
      update: {},
      create: { idExternoErp, incompleto: true, sincronizadoEm: new Date() },
    });

    if (pedido.incompleto) {
      this.logger.warn(
        `Pedido ${idExternoErp} ainda nao sincronizado - stub criado/reaproveitado para a nota fiscal referenciar`,
      );
    }

    return pedido.id;
  }
}

// Tipo do client de transacao do Prisma (this.prisma.$transaction(tx => ...))
type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

// DataEmissaoInicial/Final sao "date" (YYYY-MM-DD), nao "date-time" -
// confirmado contra o ambiente de testes (ver comentario em fetch()).
function formatarDataWkRadarSemHora(data: Date): string {
  return data.toISOString().slice(0, 10);
}
