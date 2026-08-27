import { Injectable, NotFoundException } from '@nestjs/common';
import { ErpClientService } from '../erp-client/erp-client.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';

// ErpClientService.baseUrl ja inclui {host}/wk.api/api - so o sufixo do
// recurso aqui (mesmo padrao das sync strategies, ver cliente.sync.ts).
const ROTA_TITULO_CONTAS_RECEBER = '/financeiro/v1/titulo-contas-receber';

// Subconjunto de ReadTituloContasReceberDto - so o necessario pra somar
// valor em aberto/vencido (OS-BACKEND-36). O DTO NAO devolve a situacao do
// titulo (EmAberto/Vencidos e' so filtro de query, nao campo de resposta -
// confirmado contra o swagger.json), por isso obterResumo faz uma chamada
// por situacao em vez de uma so chamada com as duas.
interface WkRadarTituloContasReceber {
  id: string;
  valor: number;
  valorBaixado: number;
}

interface GrupoTitulos {
  quantidade: number;
  valorTotal: number;
}

export interface ClienteFinanceiroDto {
  clienteId: string;
  limiteCredito: number | null;
  dataLimiteCredito: string | null;
  notasEmAberto: GrupoTitulos;
  notasVencidas: GrupoTitulos;
  inadimplente: boolean;
}

// GET /clientes/:id/financeiro (OS-BACKEND-36) - limiteCredito vem do
// cadastro ja sincronizado (Cliente.limiteCredito, ver cliente.sync.ts);
// notas em aberto/vencidas sao consultadas sob demanda direto no WK Radar
// (financeiro/v1/titulo-contas-receber), sem persistir localmente - dado
// transacional que muda a cada pagamento, natureza diferente do resto do
// cadastro (ver comentario em schema.prisma, model Cliente).
@Injectable()
export class ClienteFinanceiroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erpClient: ErpClientService,
  ) {}

  async obter(clienteId: string, escopo: EscopoClientes): Promise<ClienteFinanceiroDto> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, ...whereEscopo },
      select: { idExternoErp: true, limiteCredito: true, dataLimiteCredito: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const [emAberto, vencidas] = await Promise.all([
      this.buscarGrupo(cliente.idExternoErp, 'EmAberto'),
      this.buscarGrupo(cliente.idExternoErp, 'Vencidos'),
    ]);

    return {
      clienteId,
      limiteCredito: cliente.limiteCredito?.toNumber() ?? null,
      dataLimiteCredito: cliente.dataLimiteCredito?.toISOString() ?? null,
      notasEmAberto: emAberto,
      notasVencidas: vencidas,
      inadimplente: vencidas.quantidade > 0,
    };
  }

  private async buscarGrupo(
    idSacado: string,
    situacao: 'EmAberto' | 'Vencidos',
  ): Promise<GrupoTitulos> {
    const titulos = await this.erpClient.get<WkRadarTituloContasReceber[]>(
      ROTA_TITULO_CONTAS_RECEBER,
      {
        IdSacado: idSacado,
        Situacao: [situacao],
        Fields: ['id', 'valor', 'valorBaixado'],
      },
    );

    return titulos.reduce<GrupoTitulos>(
      (grupo, titulo) => ({
        quantidade: grupo.quantidade + 1,
        valorTotal: arredondarMoeda(
          grupo.valorTotal + (titulo.valor - titulo.valorBaixado),
        ),
      }),
      { quantidade: 0, valorTotal: 0 },
    );
  }
}

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
