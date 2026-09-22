import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDataHoraBr } from '../../common/parse-data-br';
import { parseDecimalBr } from '../../common/parse-decimal-br';
import { PrismaService } from '../../prisma/prisma.service';
import { buildSaldoEstoqueLotesConfig } from '../../wk-bi-client/build-saldo-estoque-lotes-config';
import { WkBiClientService } from '../../wk-bi-client/wk-bi-client.service';
import type {
  EstoqueLoteBrutoAgrupado,
  EstoqueLoteMapeado,
  LinhaSaldoEstoqueWkBi,
} from './estoque-lote.types';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';

// nomeEntidade = 'estoque_lote' (underscore, nao hifen - mesmo motivo de
// saldo_estoque, ver aquele arquivo: SyncService.obterDesde() deriva a env
// var da carga inicial via toUpperCase(), hifen quebraria o nome).
//
// IGNORA o cursor incremental (janela.desde) e agendamento e' omitido de
// proposito (default = 'INCREMENTAL', roda a cada 30 min via
// SyncScheduler.agendarIncrementais - decisao do usuario, ver
// OS-pendentes-claude-code.md) - CodProdutos="" traz o catalogo completo
// numa chamada so (confirmado via teste real: 3879 linhas/374 produtos/
// ~28s, sem paginacao, ver skill wk-radar-bi-client), full refresh a cada
// execucao em vez de incremental por natureza (o relatorio nao tem filtro
// de "alterado desde", mesmo motivo de nota-fiscal/saldo_estoque/
// tabela-preco).
//
// Full refresh por PRODUTO (nao por linha isolada) - upsert() precisa ver
// o conjunto completo de lotes de um produto pra saber quais sumiram e
// devem ser removidos (mesmo padrao de TabelaPrecoSyncStrategy pros itens
// de uma tabela). LIMITACAO ACEITA: um produto que fica com saldo ZERO em
// TODOS os locais desaparece inteiramente da resposta
// (ImprimirSaldosZerados="0", ver build-saldo-estoque-lotes-config.ts) -
// suas linhas antigas em EstoqueLote ficam stale, nunca limpas por este
// mecanismo (nao ha' "registro vazio" desse produto pra upsert() processar
// e disparar a limpeza). Reavaliar se isso importar na pratica.
@Injectable()
export class EstoqueLoteSyncStrategy
  implements SyncStrategy<EstoqueLoteBrutoAgrupado, EstoqueLoteMapeado>
{
  readonly nomeEntidade = 'estoque_lote';

  private readonly wkBiEmpresa: string;

  constructor(
    private readonly wkBiClientService: WkBiClientService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.wkBiEmpresa = this.configService.getOrThrow<string>('WK_BI_EMPRESA');
  }

  async fetch(
    _janela: SyncWindow,
  ): Promise<SyncFetchResultado<EstoqueLoteBrutoAgrupado>> {
    const config = buildSaldoEstoqueLotesConfig({
      empresa: this.wkBiEmpresa,
      // "" traz TODOS os produtos numa chamada so (confirmado via teste
      // real, ver skill wk-radar-bi-client) - diferente da consulta
      // pontual (EstoqueService), que sempre passa um codigo unico e
      // validado.
      codigoProduto: '',
    });
    const linhas = await this.wkBiClientService.buscarRelatorioExportacaoAutomatica(config);

    const porProduto = new Map<string, LinhaSaldoEstoqueWkBi[]>();
    for (const linha of linhas as LinhaSaldoEstoqueWkBi[]) {
      const codigoProduto = linha['Cod.'];
      if (!codigoProduto) continue;
      const lista = porProduto.get(codigoProduto) ?? [];
      lista.push(linha);
      porProduto.set(codigoProduto, lista);
    }

    const registros = Array.from(porProduto.entries()).map(
      ([codigoProduto, linhasProduto]) => ({
        codigoProduto,
        linhas: linhasProduto,
      }),
    );

    return { registros, avisos: [] };
  }

  map(bruto: EstoqueLoteBrutoAgrupado): EstoqueLoteMapeado {
    return {
      codigoProduto: bruto.codigoProduto,
      itens: bruto.linhas.map((linha) => {
        const fabricadoEmTexto = linha['Fabricado Em'];
        return {
          lote: linha.Lote || '',
          localCodigo: linha['Código Local'] || '',
          localNome: linha['Nome do Local'] || '',
          quantidade: parseDecimalBr(String(linha['Qtde Estoque'] ?? '0')),
          fabricadoEm: fabricadoEmTexto ? parseDataHoraBr(fabricadoEmTexto) : null,
        };
      }),
    };
  }

  async upsert(mapeado: EstoqueLoteMapeado): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        for (const item of mapeado.itens) {
          await tx.estoqueLote.upsert({
            where: {
              codigoProduto_lote_localCodigo: {
                codigoProduto: mapeado.codigoProduto,
                lote: item.lote,
                localCodigo: item.localCodigo,
              },
            },
            create: { codigoProduto: mapeado.codigoProduto, ...item },
            update: item,
          });
        }

        // Full refresh - lote que sumiu da resposta pra este produto
        // (vendido por completo, transferido de local etc.) nao deveria
        // continuar valendo localmente, mesmo criterio ja aplicado em
        // TabelaPrecoSyncStrategy pros itens de uma tabela.
        const chavesAtuais = new Set(
          mapeado.itens.map((item) => `${item.lote}\u0000${item.localCodigo}`),
        );
        const existentes = await tx.estoqueLote.findMany({
          where: { codigoProduto: mapeado.codigoProduto },
          select: { id: true, lote: true, localCodigo: true },
        });
        const idsObsoletos = existentes
          .filter((e) => !chavesAtuais.has(`${e.lote}\u0000${e.localCodigo}`))
          .map((e) => e.id);
        if (idsObsoletos.length > 0) {
          await tx.estoqueLote.deleteMany({ where: { id: { in: idsObsoletos } } });
        }
      },
      { timeout: 30_000 },
    );
  }
}
