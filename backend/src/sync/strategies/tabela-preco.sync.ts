import { Injectable } from '@nestjs/common';
import { parseDataHoraBr } from '../../common/parse-data-br';
import { parseDecimalBr } from '../../common/parse-decimal-br';
import { EmpresarialSvcClientService } from '../../empresarial-svc-client/empresarial-svc-client.service';
import type {
  ItemTabelaPrecoBruto,
  TabelaPrecoBruta,
} from '../../empresarial-svc-client/empresarial-svc-client.types';
import { PrismaService } from '../../prisma/prisma.service';
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

// nomeEntidade = 'tabela-preco'. IGNORA o cursor incremental (janela.desde),
// mesmo padrao ja usado por SaldoEstoqueSyncStrategy - confirmado
// empiricamente em 2026-09-08: `filtro:{}` (sem Codigo) traz TODAS as
// tabelas de preco ativas numa chamada so, sem paginacao/filtro
// incremental disponivel nesta operacao. Full refresh a cada execucao e'
// mais simples e mais confiavel do que depender de algo nao suportado.
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
  ) {}

  async fetch(_janela: SyncWindow): Promise<SyncFetchResultado<TabelaPrecoBruta>> {
    const registros = await this.empresarialSvcClient.buscarTabelasPreco();
    return { registros, avisos: [] };
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
    await this.prisma.$transaction(async (tx) => {
      const sincronizadoEm = new Date();

      // `padrao` deliberadamente FORA daqui - campo administrativo (ver
      // TabelaPrecoService.definirPadrao), nunca sobrescrito pelo sync.
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

      for (const item of mapeado.itens) {
        await tx.itemTabelaPreco.upsert({
          where: {
            tabelaPrecoId_codigoItem: {
              tabelaPrecoId: tabela.id,
              codigoItem: item.codigoItem,
            },
          },
          create: { tabelaPrecoId: tabela.id, ...item },
          update: item,
        });
      }

      // Full refresh - item que sumiu da resposta do ERP nao deveria
      // continuar valendo localmente (ex: item removido da tabela de
      // preco). Deleta o que nao veio nesta chamada.
      await tx.itemTabelaPreco.deleteMany({
        where: {
          tabelaPrecoId: tabela.id,
          codigoItem: { notIn: mapeado.itens.map((item) => item.codigoItem) },
        },
      });
    });
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
