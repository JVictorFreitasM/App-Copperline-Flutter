import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceiroSvcClientService } from '../financeiro-svc-client/financeiro-svc-client.service';
import type { PosicaoFinanceiraBruta } from '../financeiro-svc-client/financeiro-svc-client.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';

export interface ClienteFinanceiroDto {
  clienteId: string;
  limiteCredito: number;
  limiteCreditoSerasa: number;
  creditoDisponivel: number;
  creditoUtilizado: number;
  saldoAVencer: number;
  saldoVencido: number;
  maiorAtraso: number;
  mediaAtraso: number;
  qtdeBaixasPorInadimplencia: number;
  totalDeCompras: number;
  dataUltimaFatura: string | null;
  vendaBloqueada: boolean;
  inadimplente: boolean;
}

// GET /clientes/:id/financeiro (OS-BACKEND-36, revisao) - fonte e'
// BuscarPosicaoFinanceira (SOAP Financeiro.svc, via FinanceiroSvcClientService),
// NAO somatorio manual de titulo-contas-receber (REST) - o ERP ja entrega
// o perfil de credito calculado (limite, disponivel, utilizado, saldo a
// vencer/vencido, atraso medio/maior, bloqueio de venda), decisao
// confirmada pelo usuario. Sem persistir localmente - dado transacional
// consultado sob demanda (mesmo criterio do Cliente.limiteCredito nao ser
// mais usado aqui: aquele vem do cadastro sincronizado, este e' o
// snapshot completo em tempo real do Radar).
@Injectable()
export class ClienteFinanceiroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiroSvcClient: FinanceiroSvcClientService,
  ) {}

  async obter(
    clienteId: string,
    escopo: EscopoClientes,
  ): Promise<ClienteFinanceiroDto> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, ...whereEscopo },
      select: { idExternoErp: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const posicao = await this.financeiroSvcClient.buscarPosicaoFinanceira(
      cliente.idExternoErp,
    );
    if (!posicao) {
      throw new NotFoundException(
        `Posição financeira não encontrada no ERP para o cliente '${clienteId}'`,
      );
    }

    return paraDto(clienteId, posicao);
  }
}

function paraDto(
  clienteId: string,
  posicao: PosicaoFinanceiraBruta,
): ClienteFinanceiroDto {
  return {
    clienteId,
    limiteCredito: posicao.ValorLimite,
    limiteCreditoSerasa: posicao.ValorLimiteSerasa,
    creditoDisponivel: posicao.ValorCreditoDisponivel,
    creditoUtilizado: posicao.ValorCreditoUtilizado,
    saldoAVencer: posicao.ValorSaldoAVencer,
    saldoVencido: posicao.ValorSaldoVencido,
    maiorAtraso: posicao.ValorMaiorAtraso,
    mediaAtraso: posicao.MediaAtraso,
    qtdeBaixasPorInadimplencia: posicao.QtdeBaixasPorInadimplencia,
    totalDeCompras: posicao.ValorTotalDeCompras,
    dataUltimaFatura: posicao.DataUltimaFatura,
    vendaBloqueada: posicao.VendaBloqueada,
    inadimplente: posicao.ValorSaldoVencido > 0,
  };
}
