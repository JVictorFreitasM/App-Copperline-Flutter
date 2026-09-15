import { Injectable } from '@nestjs/common';
import { parseDataHoraBr } from '../../common/parse-data-br';
import { parseDecimalBr } from '../../common/parse-decimal-br';
import { EmpresarialSvcClientService } from '../../empresarial-svc-client/empresarial-svc-client.service';
import type {
  ItemTabelaPrecoBruto,
  TabelaPrecoBruta,
} from '../../empresarial-svc-client/empresarial-svc-client.types';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfiguracaoTabelaPrecoService } from '../../tabelas-preco/configuracao-tabela-preco.service';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';

export interface ItemTabelaPrecoMapeado {
  codigoItem: string;
  preco: string;
  precoPromocional: string | null;
  quantidadeMinima: string;
  quantidadeMaxima: string;
  percentualDescontoMaximo: string;
  valorDescontoMaximo: string;
  dataUltimoReajuste: Date | null;
  dataInicioPromocao: Date | null;
  dataFimPromocao: Date | null;
}

export interface TabelaPrecoMapeada {
  idExternoErp: string;
  codigo: string;
  ativa: boolean;
  itens: ItemTabelaPrecoMapeado[];
}

// nomeEntidade = 'tabela-preco'. IGNORA o cursor incremental (janela.desde)
// - decisao revisada com o usuario: NAO faz mais full refresh (`filtro:{}`,
// todas as tabelas). Confirmado empiricamente em 2026-09-08 que isso leva
// 90-190s so' na chamada (~7,9MB de resposta, dezenas de tabelas), contra
// poucos segundos consultando UM codigo especifico (mesma operacao,
// `filtro:{Codigo: x}`) - exatamente o que o Postman testa. O sync agora
// so busca o codigo configurado em ConfiguracaoTabelaPrecoService - sem
// selecao (codigoSelecionado null), fetch() nao chama a API NENHUMA vez
// (nada pra sincronizar ainda).
//
// agendamento='CONFIGURAVEL' (ver sync-strategy.interface.ts) - intervalo
// editavel via GET/PATCH /admin/sync/configuracoes (mesmo mecanismo ja
// generalizado pra saldo_estoque, OS-BACKEND-15/16) - sem endpoint novo
// pra "configurar intervalo de sincronizacao", ja existe.
@Injectable()
export class TabelaPrecoSyncStrategy
  implements SyncStrategy<TabelaPrecoBruta, TabelaPrecoMapeada>
{
  readonly nomeEntidade = 'tabela-preco';
  readonly agendamento = 'CONFIGURAVEL' as const;

  constructor(
    private readonly empresarialSvcClient: EmpresarialSvcClientService,
    private readonly prisma: PrismaService,
    private readonly configuracaoTabelaPrecoService: ConfiguracaoTabelaPrecoService,
  ) {}

  // OS-novas-implementacoes.md Bloco 1 - alem do codigo global
  // (ConfiguracaoTabelaPrecoService, comportamento original), agora
  // tambem acompanha toda tabela associada a algum cliente
  // (ClienteTabelaPreco) - decisao confirmada com o usuario: sincronizar N
  // tabelas em sequencia (~15s cada) e' aceitavel. Cada codigo busca numa
  // chamada separada (a API so aceita um `Codigo` por vez no filtro, ver
  // empresarial-svc-client) - sem chamada nenhuma se nao houver codigo
  // algum configurado (nem global, nem por cliente).
  async fetch(_janela: SyncWindow): Promise<SyncFetchResultado<TabelaPrecoBruta>> {
    const codigos = await this.obterCodigosParaSincronizar();
    if (codigos.length === 0) {
      return {
        registros: [],
        avisos: [
          'Nenhuma tabela de preco selecionada (nem global, nem associada a cliente) - configure via PATCH /admin/tabelas-preco/configuracao ou POST /admin/clientes/:clienteId/tabelas-preco antes de sincronizar.',
        ],
      };
    }

    const registros: TabelaPrecoBruta[] = [];
    for (const codigo of codigos) {
      registros.push(...(await this.empresarialSvcClient.buscarTabelasPreco(codigo)));
    }
    return { registros, avisos: [] };
  }

  private async obterCodigosParaSincronizar(): Promise<string[]> {
    const codigoGlobal = await this.configuracaoTabelaPrecoService.obterCodigoSelecionado();
    const codigosDeCliente = await this.prisma.clienteTabelaPreco.findMany({
      select: { codigo: true },
      distinct: ['codigo'],
    });

    const codigos = new Set<string>();
    if (codigoGlobal) codigos.add(codigoGlobal);
    for (const associacao of codigosDeCliente) codigos.add(associacao.codigo);
    return [...codigos];
  }

  map(bruto: TabelaPrecoBruta): TabelaPrecoMapeada {
    return {
      idExternoErp: bruto.Id,
      codigo: bruto.Codigo,
      ativa: bruto.Ativa,
      itens: bruto.ItensTabelaPreco.map(mapearItem),
    };
  }

  async upsert(mapeado: TabelaPrecoMapeada): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const sincronizadoEm = new Date();

        const tabela = await tx.tabelaPreco.upsert({
          where: { idExternoErp: mapeado.idExternoErp },
          create: {
            idExternoErp: mapeado.idExternoErp,
            codigo: mapeado.codigo,
            ativa: mapeado.ativa,
            sincronizadoEm,
          },
          update: {
            codigo: mapeado.codigo,
            ativa: mapeado.ativa,
            sincronizadoEm,
          },
        });

        // Paralelo (nao sequencial) - confirmado empiricamente em
        // 2026-09-08: uma tabela com centenas de itens estourava o timeout
        // PADRAO de transacao interativa do Prisma (5s) fazendo um upsert
        // de cada vez. `timeout` explicito abaixo da uma margem generosa
        // de qualquer forma, pro caso raro de uma tabela MUITO grande.
        await Promise.all(
          mapeado.itens.map((item) =>
            tx.itemTabelaPreco.upsert({
              where: {
                tabelaPrecoId_codigoItem: {
                  tabelaPrecoId: tabela.id,
                  codigoItem: item.codigoItem,
                },
              },
              create: { tabelaPrecoId: tabela.id, ...item },
              update: item,
            }),
          ),
        );

        // Full refresh - item que sumiu da resposta do ERP nao deveria
        // continuar valendo localmente (ex: item removido da tabela de
        // preco). Deleta o que nao veio nesta chamada.
        await tx.itemTabelaPreco.deleteMany({
          where: {
            tabelaPrecoId: tabela.id,
            codigoItem: { notIn: mapeado.itens.map((item) => item.codigoItem) },
          },
        });
      },
      { timeout: 60_000 },
    );
  }
}

function mapearItem(bruto: ItemTabelaPrecoBruto): ItemTabelaPrecoMapeado {
  return {
    codigoItem: bruto.CodigoItem,
    preco: parseDecimalBr(bruto.Preco),
    precoPromocional: bruto.PrecoPromocional ? parseDecimalBr(bruto.PrecoPromocional) : null,
    quantidadeMinima: parseDecimalBr(bruto.QuantidadeMinima),
    quantidadeMaxima: parseDecimalBr(bruto.QuantidadeMaxima),
    percentualDescontoMaximo: parseDecimalBr(bruto.PercentualDescontoMaximo),
    valorDescontoMaximo: parseDecimalBr(bruto.ValorDescontoMaximo),
    dataUltimoReajuste: parseDataHoraBr(bruto.DataUltimoReajuste),
    dataInicioPromocao: parseDataHoraBr(bruto.DataInicioPromocao),
    dataFimPromocao: parseDataHoraBr(bruto.DataFimPromocao),
  };
}
