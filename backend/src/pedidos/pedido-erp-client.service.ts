import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErpClientService } from '../erp-client/erp-client.service';

export interface PedidoErpItemInput {
  produtoIdExterno: string;
  idTabelaPreco: string;
  quantidade: number;
  valorUnitario: number;
}

export interface PedidoErpParcelaInput {
  idFormaPagamento: string;
  dataVencimento: Date;
  valor: number;
}

export interface PedidoErpCriarInput {
  clienteIdExterno: string;
  vendedorIdExterno: string;
  idCondicaoPagamento: string;
  percentualDesconto: number;
  itens: PedidoErpItemInput[];
  parcelas: PedidoErpParcelaInput[];
}

export interface PedidoErpCriarResultado {
  idExterno: string;
  codigoIntegrador: string;
}

interface WkRadarPedidoCriarResposta {
  id: string;
  codigoIntegrador: string | null;
}

// OS-BACKEND-25 - envio real de pedido ao WK Radar (POST
// /comercial/v1/pedido). Contrato de request confirmado pelo usuario
// (swagger real do ambiente, 2026-09-16) - a API grava uma LISTA de
// pedidos por chamada (sempre 1 elemento aqui, este sistema so cria
// pedido individual); resposta de sucesso e' `[{id, codigoIntegrador}]`,
// um item por pedido enviado, na mesma ordem.
//
// Campos DELIBERADAMENTE fora do payload (confirmado com o usuario, nunca
// adivinhado):
// - idOperacaoComercial / idClassificacao / idNaturezaOperacaoProduto /
//   itens[].idNaturezaOperacao: quem preenche e' o setor de faturamento,
//   DEPOIS da criacao do pedido - nao no momento da venda.
// - localEntrega / transporte / volume / kits / rateios / beneficiario /
//   intermediador / informacoesExtras / consumidorFinal: blocos
//   fiscais/logisticos fora do escopo confirmado ate agora - omitir
//   deixa o Radar aplicar o proprio default, em vez de inventar um valor
//   aqui.
//
// Desconto (`total.percentualDescontoProdutos`) e' aplicado uma vez sobre
// o SUBTOTAL do pedido inteiro (mesmo modelo ja usado em
// CriarPedidoService - nunca distribuido por item), por isso
// `itens[].valorUnitario` vai SEM desconto (preco de tabela puro) e quem
// resolve o valor final e' o proprio Radar a partir do total.
@Injectable()
export class PedidoErpClientService {
  private readonly idFilial: string;
  private readonly idUnidadeVenda: string;

  constructor(
    private readonly erpClient: ErpClientService,
    configService: ConfigService,
  ) {
    // Confirmados empiricamente contra 300 pedidos reais ja fechados pela
    // empresa (idFilial: 100% dos casos = 16384; idUnidadeVenda: ~98.5%
    // dos itens = 229376) - em env var, nao hardcoded, pra poder trocar
    // sem deploy se a empresa abrir uma segunda filial/unidade de venda.
    this.idFilial = configService.getOrThrow<string>('WK_RADAR_ID_FILIAL');
    this.idUnidadeVenda = configService.getOrThrow<string>(
      'WK_RADAR_ID_UNIDADE_VENDA',
    );
  }

  async criar(input: PedidoErpCriarInput): Promise<PedidoErpCriarResultado> {
    const payload = {
      idFilial: this.idFilial,
      dataEmissao: formatarDataIso(new Date()),
      idCliente: input.clienteIdExterno,
      vendedores: [{ id: input.vendedorIdExterno }],
      itens: input.itens.map((item) => ({
        produtoServico: { tipo: 'Produto', id: item.produtoIdExterno },
        idTabelaPreco: item.idTabelaPreco,
        idUnidadeVenda: this.idUnidadeVenda,
        quantidadeVenda: item.quantidade,
        valorUnitario: item.valorUnitario,
      })),
      total: {
        percentualDescontoProdutos: input.percentualDesconto,
        descontoProdutosEmPercentual: true,
      },
      faturamento: {
        idCondicaoPagamento: input.idCondicaoPagamento,
        parcelas: input.parcelas.map((parcela) => ({
          idFormaPagamento: parcela.idFormaPagamento,
          dataVencimento: formatarDataIso(parcela.dataVencimento),
          valor: parcela.valor,
        })),
      },
    };

    const resposta = await this.erpClient.post<WkRadarPedidoCriarResposta[]>(
      '/comercial/v1/pedido',
      [payload],
    );

    const criado = resposta[0];
    if (!criado) {
      throw new Error(
        'WK Radar respondeu sem nenhum pedido criado (lista vazia) - envio pode ter falhado silenciosamente',
      );
    }
    return {
      idExterno: criado.id,
      codigoIntegrador: criado.codigoIntegrador ?? '',
    };
  }
}

// "YYYY-MM-DD" - formato confirmado do schema de REQUEST (diferente do
// DD/MM/YYYY usado nas respostas de LEITURA, ver parseDataBrWkRadar em
// pedido.sync.ts - nao confundir os dois sentidos).
function formatarDataIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}
