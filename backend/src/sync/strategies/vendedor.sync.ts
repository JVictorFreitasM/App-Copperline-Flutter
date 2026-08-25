import { Injectable, Logger } from '@nestjs/common';
import { ErpClientService } from '../../erp-client/erp-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { contagemSuspeitaDeTruncamento } from '../paginacao-por-janela';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';
import type { VendedorMapeado, WkRadarVendedor } from './vendedor.types';

// ErpClientService.baseUrl ja inclui {host}/wk.api/api (ver skill
// wk-radar-client, secao "Base de URL") - aqui so o sufixo do recurso.
const ROTA_VENDEDOR = '/empresarial/v1/vendedor';

const CAMPOS_VENDEDOR = ['id', 'codigoIntegrador', 'codigo', 'nome', 'email', 'inativo'];

// ATENCAO - estruturalmente diferente de produto/pedido (cursor unico) e de
// cliente/nota-fiscal (par de datas): o endpoint /vendedor nao tem NENHUM
// filtro de data (so nome/codigo/situacao/comissao/filial - confirmado
// contra o swagger.json do ambiente de testes). Sem filtro de "alterado
// desde", nao ha como fazer sync incremental de verdade - toda execucao
// busca a lista inteira (volume tipicamente baixo - dezenas/poucas
// centenas de vendedores - sem necessidade de fatiar por janela como
// produto/cliente). Por isso agendamento e' 'JANELA_FIXA_DIARIA' (mesmo
// padrao de NotaFiscalSyncStrategy pra recursos sem cursor de alteracao) e
// fetch() ignora `janela` completamente - uma unica chamada, sem
// paginacao por sub-janela.
@Injectable()
export class VendedorSyncStrategy implements SyncStrategy<
  WkRadarVendedor,
  VendedorMapeado
> {
  readonly nomeEntidade = 'vendedor';
  readonly agendamento = 'JANELA_FIXA_DIARIA' as const;
  private readonly logger = new Logger(VendedorSyncStrategy.name);

  constructor(
    private readonly erpClient: ErpClientService,
    private readonly prisma: PrismaService,
  ) {}

  async fetch(
    _janela: SyncWindow,
  ): Promise<SyncFetchResultado<WkRadarVendedor>> {
    const registros = await this.erpClient.get<WkRadarVendedor[]>(
      ROTA_VENDEDOR,
      { Situacao: 'Todos', Fields: CAMPOS_VENDEDOR },
    );

    const avisos: string[] = [];
    if (contagemSuspeitaDeTruncamento(registros.length)) {
      avisos.push(
        `Busca de vendedores retornou exatamente ${registros.length} registro(s) - suspeita de truncamento silencioso nao documentado pela API`,
      );
    }

    return { registros, avisos };
  }

  map(bruto: WkRadarVendedor): VendedorMapeado {
    return {
      idExternoErp: bruto.id,
      codigoIntegrador: bruto.codigoIntegrador ?? null,
      codigo: bruto.codigo ?? null,
      nome: bruto.nome ?? null,
      email: bruto.email ?? null,
      inativo: bruto.inativo,
    };
  }

  async upsert(mapeado: VendedorMapeado): Promise<void> {
    const sincronizadoEm = new Date();

    // Vinculo com Usuario e' calculado aqui (nao vem do WK Radar) - por
    // correspondencia de e-mail, case-insensitive (mesmo padrao ja usado
    // em busca.service.ts). Usuario so existe apos o primeiro login desse
    // vendedor no app (ver UsuariosService.obterOuCriarPorSub) - ausencia
    // de correspondencia e' esperada, nao um erro: sinalizada via
    // semCorrespondenciaUsuario, sem lancar excecao (nao pode derrubar a
    // sincronizacao dos demais vendedores, ver SyncService.executar).
    const usuarioCorrespondente = mapeado.email
      ? await this.prisma.usuario.findFirst({
          where: { email: { equals: mapeado.email, mode: 'insensitive' } },
          select: { id: true },
        })
      : null;

    if (!usuarioCorrespondente) {
      this.logger.warn(
        `Vendedor ${mapeado.idExternoErp} (${mapeado.email ?? 'sem e-mail'}) sem usuario correspondente no sistema de autenticacao - vinculo fica pendente ate o proximo full refresh.`,
      );
    }

    const campos = {
      codigoIntegrador: mapeado.codigoIntegrador,
      codigo: mapeado.codigo,
      nome: mapeado.nome,
      email: mapeado.email,
      inativo: mapeado.inativo,
      usuarioId: usuarioCorrespondente?.id ?? null,
      semCorrespondenciaUsuario: !usuarioCorrespondente,
      sincronizadoEm,
    };

    await this.prisma.vendedor.upsert({
      where: { idExternoErp: mapeado.idExternoErp },
      create: { idExternoErp: mapeado.idExternoErp, ...campos },
      update: campos,
    });
  }
}
