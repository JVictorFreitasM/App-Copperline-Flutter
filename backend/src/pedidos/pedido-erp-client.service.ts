import { Injectable } from '@nestjs/common';

export interface PedidoErpItemInput {
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
}

export interface PedidoErpCriarInput {
  clienteId: string;
  vendedorId: string;
  percentualDesconto: number;
  itens: PedidoErpItemInput[];
}

export interface PedidoErpCriarResultado {
  idExterno: string;
  codigoIntegrador: string;
}

// PENDENCIA (OS-BACKEND-25): o contrato de POST /comercial/v1/pedido foi
// confirmado (request e response da API real, ver skill wk-radar-client) -
// o que falta sao os valores FIXOS de referencia da propria empresa que o
// payload de criacao exige (idFilial, idOperacaoComercial,
// idNaturezaOperacao por item, idTabelaPreco, idUnidadeVenda,
// idCondicaoPagamento). Sem esses valores, montar o payload real seria
// inventar dado de negocio - decisao explicita (confirmada com o usuario)
// de pausar so esta parte, em vez de adivinhar.
//
// Fail-closed deliberado, mesmo padrao ja usado pra WK_RADAR_*/LLM/Firebase
// quando falta credencial/config: o resto do fluxo de criacao de pedido
// (validacao de escopo, calculo por tipo de venda, regra de aprovacao de
// desconto, persistencia local) esta pronto e testado - so a chamada real
// ao Radar fica bloqueada aqui, nunca falsificando sucesso.
@Injectable()
export class PedidoErpClientService {
  async criar(_input: PedidoErpCriarInput): Promise<PedidoErpCriarResultado> {
    throw new Error(
      'Envio de pedido ao WK Radar ainda não implementado - faltam os valores fixos de referência da empresa (idFilial, idOperacaoComercial, idNaturezaOperacao, idTabelaPreco, idUnidadeVenda, idCondicaoPagamento) necessários para montar o payload de POST /comercial/v1/pedido. Ver OS-BACKEND-25.',
    );
  }
}
