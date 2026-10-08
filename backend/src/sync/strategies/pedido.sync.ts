import { Injectable, Logger } from '@nestjs/common';
import type {
  SituacaoItemPedido,
  TipoSituacaoPedido,
} from '../../../generated/prisma/client';
import { CredenciaisErpService } from '../../credenciais-erp/credenciais-erp.service';
import { ErpClientService } from '../../erp-client/erp-client.service';
import { registrarEventoNotificacao } from '../../notificacoes/evento-notificacao.service';
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
  PedidoMapeado,
  SituacaoItemPedidoWkRadar,
  SituacaoPedidoWkRadar,
  WkRadarPedido,
} from './pedido.types';

// ErpClientService.baseUrl ja inclui {host}/wk.api/api (ver skill
// wk-radar-client, secao "Base de URL") - aqui so o sufixo do recurso.
const ROTA_PEDIDO = '/comercial/v1/pedido';

const CAMPOS_PEDIDO = [
  'id',
  'codigoIntegrador',
  'numero',
  'situacao',
  'dataHoraUltimaAlteracao',
  'dataEmissao',
  'idCliente',
  'localEntrega.idMunicipio',
  'vendedores.id',
  'total.valorTotal',
  'itens.numero',
  'itens.produtoServico',
  'itens.quantidadeVenda',
  'itens.valorUnitario',
  'itens.valorTotal',
  'itens.situacao',
];

// 2 primeiros digitos do codigo IBGE de municipio (7 digitos) identificam
// a UF - tabela estatica oficial do IBGE, sem necessidade de sincronizar
// um catalogo de municipios so pra resolver isso (ver pedido.types.ts,
// WkRadarLocalEntrega).
const IBGE_UF_POR_PREFIXO: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

// Exportado - ver comentario de parseDataBrWkRadar abaixo sobre reaproveitamento.
export const MAPA_SITUACAO: Record<SituacaoPedidoWkRadar, TipoSituacaoPedido> = {
  EmAnalise: 'EM_ANALISE',
  Bloqueado: 'BLOQUEADO',
  Pendente: 'PENDENTE',
  Cancelado: 'CANCELADO',
  ParcialmenteFaturado: 'PARCIALMENTE_FATURADO',
  Faturado: 'FATURADO',
  ParcialmenteAtendido: 'PARCIALMENTE_ATENDIDO',
  Atendido: 'ATENDIDO',
};

const MAPA_SITUACAO_ITEM: Record<
  SituacaoItemPedidoWkRadar,
  SituacaoItemPedido
> = {
  Nenhum: 'NENHUM',
  Cancelado: 'CANCELADO',
  Faturado: 'FATURADO',
  ParcialmenteFaturado: 'PARCIALMENTE_FATURADO',
  Atendido: 'ATENDIDO',
  ParcialmenteAtendido: 'PARCIALMENTE_ATENDIDO',
  Pendente: 'PENDENTE',
};

// Pedido e transacional (criado/alterado com frequencia bem maior que
// cadastro de cliente/produto) - janela propria, mais curta, nao herdada
// das outras strategies. Configuravel via WK_RADAR_JANELA_PEDIDO_MS.
const TAMANHO_JANELA_PADRAO_MS = 2 * 60 * 60 * 1000; // 2 horas

@Injectable()
export class PedidoSyncStrategy implements SyncStrategy<
  WkRadarPedido,
  PedidoMapeado
> {
  readonly nomeEntidade = 'pedido';
  // Volume de itens alto o bastante pra disputar o limite de requisicoes
  // do WK Radar se rodasse a cada 30 min durante o expediente (ver
  // sync-strategy.interface.ts) - roda de madrugada, uma vez por dia.
  readonly agendamento = 'INCREMENTAL_NOTURNO' as const;
  private readonly logger = new Logger(PedidoSyncStrategy.name);

  constructor(
    private readonly erpClient: ErpClientService,
    private readonly prisma: PrismaService,
    private readonly configService: CredenciaisErpService,
  ) {}

  // Lido a cada busca (editavel no painel em Configuracoes > Integracao ERP, sem reiniciar).
  private get tamanhoJanelaMs(): number {
    return Number(this.configService.get('WK_RADAR_JANELA_PEDIDO_MS') ?? TAMANHO_JANELA_PADRAO_MS);
  }

  async fetch(janela: SyncWindow): Promise<SyncFetchResultado<WkRadarPedido>> {
    const idsVistos = new Set<string>();
    const avisos: string[] = [];
    let processados = 0;
    let comErro = 0;

    // Pedido pode acumular uma janela de backlog muito maior que as outras
    // entidades (meses, nao horas) - o SyncService generico so faz upsert
    // e avanca o cursor DEPOIS que fetch() inteiro retorna, entao uma
    // interrupcao no meio do run (restart do container, deploy) jogava
    // fora todo o progresso e o cursor ficava preso pra sempre no inicio
    // do backlog (incidente real: sync_entities.pedido.ultima_sincronizacao
    // travado em 2024-12-01 por meses, pedidos locais nunca tendo
    // dataHoraUltimaAlteracao preenchida de volta). Por isso, so pra essa
    // strategy, fazemos upsert + checkpoint do cursor a cada sub-janela
    // processada, em vez de esperar o fetch() inteiro terminar - cada
    // sub-janela vira uma unidade atomica (registros gravados e cursor so
    // avanca depois), sem depender do loop generico do SyncService.
    // registros_processados/registros_com_erro em sync_logs ficam 0 pra
    // pedido por causa disso - a contagem real vai nos avisos abaixo.
    for (const subJanela of gerarSubJanelas(janela, this.tamanhoJanelaMs)) {
      // Pedido so tem cursor unico (DataHoraBaseAlteracao) - mesma
      // limitacao ja documentada em produto.sync.ts: a API nao aceita um
      // limite superior, entao sub-janelas sucessivas se sobrepoem.
      // Deduplicamos por id pra nao reprocessar o mesmo pedido varias vezes
      // no mesmo run (ver skill wk-radar-client, secao "Paginacao").
      const pagina = await this.erpClient.get<WkRadarPedido[]>(ROTA_PEDIDO, {
        DataHoraBaseAlteracao: formatarDataWkRadar(subJanela.desde),
        Fields: CAMPOS_PEDIDO,
      });

      if (contagemSuspeitaDeTruncamento(pagina.length)) {
        avisos.push(
          `Sub-janela a partir de ${subJanela.desde.toISOString()} retornou exatamente ${pagina.length} registro(s) - suspeita de truncamento silencioso nao documentado pela API`,
        );
      }

      for (const pedido of pagina) {
        if (idsVistos.has(pedido.id)) {
          continue;
        }
        idsVistos.add(pedido.id);
        try {
          await this.upsert(this.map(pedido));
          processados++;
        } catch (error) {
          comErro++;
          this.logger.error(
            `Falha ao sincronizar pedido ${pedido.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      await this.prisma.syncEntity.update({
        where: { nome: this.nomeEntidade },
        data: { ultimaSincronizacao: subJanela.ate },
      });
    }

    avisos.push(
      `Checkpoint incremental por sub-janela: ${processados} pedido(s) processado(s), ${comErro} com erro.`,
    );
    return { registros: [], avisos };
  }

  map(bruto: WkRadarPedido): PedidoMapeado {
    return {
      idExternoErp: bruto.id,
      codigoIntegrador: bruto.codigoIntegrador ?? null,
      numero: bruto.numero ?? null,
      situacao: bruto.situacao ? MAPA_SITUACAO[bruto.situacao] : null,
      dataHoraUltimaAlteracao: bruto.dataHoraUltimaAlteracao
        ? new Date(bruto.dataHoraUltimaAlteracao)
        : null,
      dataEmissao: parseDataBrWkRadar(bruto.dataEmissao),
      ufEntrega: resolverUfEntrega(bruto.localEntrega?.idMunicipio),
      idVendedorExterno: bruto.vendedores?.[0]?.id ?? null,
      idClienteExterno: bruto.idCliente ?? null,
      valorTotal: bruto.total?.valorTotal ?? null,
      itens: (bruto.itens ?? []).map((item) => ({
        numero: item.numero,
        produtoServicoId: item.produtoServico?.id ?? null,
        idItemGrade1: item.produtoServico?.idItemGrade1 ?? null,
        idItemGrade2: item.produtoServico?.idItemGrade2 ?? null,
        idItemGrade3: item.produtoServico?.idItemGrade3 ?? null,
        quantidadeVenda: item.quantidadeVenda ?? null,
        valorUnitario: item.valorUnitario ?? null,
        valorTotal: item.valorTotal ?? null,
        situacao: item.situacao ? MAPA_SITUACAO_ITEM[item.situacao] : null,
      })),
    };
  }

  async upsert(mapeado: PedidoMapeado): Promise<void> {
    const sincronizadoEm = new Date();

    await this.prisma.$transaction(async (tx) => {
      const clienteId = mapeado.idClienteExterno
        ? await this.resolverOuCriarClienteStub(tx, mapeado.idClienteExterno)
        : null;
      const vendedorRadarId = mapeado.idVendedorExterno
        ? await this.resolverVendedorRadar(tx, mapeado.idVendedorExterno)
        : null;

      // Buscado ANTES do upsert - unico jeito de comparar "situacao
      // anterior x nova" (o upsert em si nao devolve o valor de antes).
      // null quando o pedido ainda nao existia (primeira sincronizacao) -
      // nesse caso NAO e' uma "mudanca", e' o pedido aparecendo pela
      // primeira vez (ver notificarSeSituacaoMudou abaixo, OS-BACKEND-19).
      const existente = await tx.pedido.findUnique({
        where: { idExternoErp: mapeado.idExternoErp },
        select: { id: true, situacao: true },
      });

      // incompleto:false tambem no update - "completa" um eventual stub
      // criado por NotaFiscalSyncStrategy (OS 09) quando o pedido de
      // verdade chega aqui.
      const pedido = await tx.pedido.upsert({
        where: { idExternoErp: mapeado.idExternoErp },
        create: {
          idExternoErp: mapeado.idExternoErp,
          codigoIntegrador: mapeado.codigoIntegrador,
          numero: mapeado.numero,
          situacao: mapeado.situacao as TipoSituacaoPedido | null,
          dataHoraUltimaAlteracao: mapeado.dataHoraUltimaAlteracao,
          dataEmissao: mapeado.dataEmissao,
          ufEntrega: mapeado.ufEntrega,
          vendedorRadarId,
          clienteId,
          valorTotal: mapeado.valorTotal,
          incompleto: false,
          sincronizadoEm,
        },
        update: {
          codigoIntegrador: mapeado.codigoIntegrador,
          numero: mapeado.numero,
          situacao: mapeado.situacao as TipoSituacaoPedido | null,
          dataHoraUltimaAlteracao: mapeado.dataHoraUltimaAlteracao,
          dataEmissao: mapeado.dataEmissao,
          ufEntrega: mapeado.ufEntrega,
          vendedorRadarId,
          clienteId,
          valorTotal: mapeado.valorTotal,
          incompleto: false,
          sincronizadoEm,
        },
      });

      await this.notificarSeSituacaoMudou(tx, pedido.id, existente?.situacao ?? null, pedido.situacao);

      for (const item of mapeado.itens) {
        const produtoId = item.produtoServicoId
          ? await this.resolverOuCriarProdutoStub(tx, item.produtoServicoId)
          : null;

        const campos = {
          produtoId,
          idItemGrade1: item.idItemGrade1,
          idItemGrade2: item.idItemGrade2,
          idItemGrade3: item.idItemGrade3,
          quantidadeVenda: item.quantidadeVenda,
          valorUnitario: item.valorUnitario,
          valorTotal: item.valorTotal,
          situacao: item.situacao as SituacaoItemPedido | null,
          sincronizadoEm,
        };

        await tx.pedidoItem.upsert({
          where: {
            pedidoId_numero: { pedidoId: pedido.id, numero: item.numero },
          },
          create: { pedidoId: pedido.id, numero: item.numero, ...campos },
          update: campos,
        });
      }
    });
  }

  // OS-BACKEND-19: so notifica mudanca de situacao REAL - `situacaoAnterior`
  // vem do findUnique feito ANTES do upsert (ver upsert() acima). null ali
  // cobre tanto "pedido novo de verdade" quanto "so existia como stub
  // incompleto de NotaFiscalSyncStrategy" (stub nunca tem situacao) - em
  // nenhum dos dois casos e' uma "mudanca" que alguem devesse ser avisado,
  // e' o pedido aparecendo pela primeira vez.
  private async notificarSeSituacaoMudou(
    tx: PrismaTx,
    pedidoId: string,
    situacaoAnterior: TipoSituacaoPedido | null,
    situacaoNova: TipoSituacaoPedido | null,
  ): Promise<void> {
    if (!situacaoAnterior || situacaoAnterior === situacaoNova) {
      return;
    }

    await registrarEventoNotificacao(tx, {
      tipo: 'PEDIDO_SITUACAO_ALTERADA',
      referenciaId: pedidoId,
      titulo: 'Pedido mudou de situação',
      corpo: `Situação alterada de ${situacaoAnterior} para ${situacaoNova ?? '—'}.`,
      dados: { pedidoId },
    });
  }

  // Cria um Cliente stub (incompleto=true, so id_externo_erp) se o pedido
  // referenciar um cliente que este sistema ainda nao sincronizou - evita
  // perder o pedido (o cursor de sync avanca mesmo com erro pontual, entao
  // pular o pedido o perderia pra sempre) sem quebrar a FK. cliente.sync.ts
  // completa os dados e zera incompleto quando sincronizar esse cliente de
  // verdade. Ver comentario no schema.prisma (model Pedido) pra mais
  // contexto.
  private async resolverOuCriarClienteStub(
    tx: PrismaTx,
    idExternoErp: string,
  ): Promise<string> {
    const cliente = await tx.cliente.upsert({
      where: { idExternoErp },
      update: {},
      create: { idExternoErp, incompleto: true, sincronizadoEm: new Date() },
    });

    if (cliente.incompleto) {
      this.logger.warn(
        `Cliente ${idExternoErp} ainda nao sincronizado - stub criado/reaproveitado para o pedido referenciar`,
      );
    }

    return cliente.id;
  }

  // Diferente de resolverOuCriarClienteStub/resolverOuCriarProdutoStub -
  // NUNCA cria stub aqui. Vendedor tem campos de autenticacao vinculados
  // (ver vendedor.sync.ts, correspondencia por e-mail contra Usuario) que
  // um stub simples nao teria como preencher direito; melhor deixar
  // vendedorRadarId null ate o vendedor de verdade ser sincronizado (roda
  // toda noite, ver VendedorSyncStrategy) do que criar um registro
  // incompleto que colidiria com o upsert real depois.
  private async resolverVendedorRadar(
    tx: PrismaTx,
    idExternoErp: string,
  ): Promise<string | null> {
    const vendedor = await tx.vendedor.findUnique({
      where: { idExternoErp },
      select: { id: true },
    });
    return vendedor?.id ?? null;
  }

  // Mesma logica de resolverOuCriarClienteStub, para produto (referenciado
  // por item de pedido via produtoServico.id).
  private async resolverOuCriarProdutoStub(
    tx: PrismaTx,
    idExternoErp: string,
  ): Promise<string> {
    const produto = await tx.produto.upsert({
      where: { idExternoErp },
      update: {},
      create: { idExternoErp, incompleto: true, sincronizadoEm: new Date() },
    });

    if (produto.incompleto) {
      this.logger.warn(
        `Produto ${idExternoErp} ainda nao sincronizado - stub criado/reaproveitado para o item de pedido referenciar`,
      );
    }

    return produto.id;
  }
}

// Tipo do client de transacao do Prisma (this.prisma.$transaction(tx => ...))
// - extraido via Parameters pra nao precisar importar um tipo interno do
// client gerado.
type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

// WK Radar aceita date-time sem milissegundos/timezone (ex:
// "2026-08-17T00:00:00") - confirmado contra o ambiente de testes.
function formatarDataWkRadar(data: Date): string {
  return data.toISOString().replace(/\.\d{3}Z$/, '');
}

// dataEmissao/dataEntrega do pedido vem em DD/MM/YYYY (confirmado
// empiricamente) - diferente do formato ISO de dataHoraUltimaAlteracao/
// dataHoraGravacao. Fail-safe: formato inesperado vira null, nunca lanca.
// Exportada - reaproveitada por PedidoErpClientService.buscarCabecalhoAtualizado
// (pedido do usuario 2026-09-28: buscar numero/situacao/datas logo apos
// criar o pedido, sem esperar o sync noturno) pra nao duplicar o parsing.
export function parseDataBrWkRadar(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
}

function resolverUfEntrega(idMunicipio: string | null | undefined): string | null {
  if (!idMunicipio || idMunicipio.length !== 7) return null;
  return IBGE_UF_POR_PREFIXO[idMunicipio.slice(0, 2)] ?? null;
}
