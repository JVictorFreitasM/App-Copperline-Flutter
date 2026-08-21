// Corpo da requisicao pra Estoque.svc/json/BuscarSaldoProduto - JSON puro
// (nao envelope SOAP/XML - apesar do nome do servico e do WSDL classico
// sugerirem SOAP, o binding real desta instalacao aceita JSON no request,
// confirmado empiricamente em 2026-08-21 via chamada real). A RESPOSTA
// ainda vem em XML (ver estoque-svc-client.service.ts) - so o request e'
// JSON, assimetria real do servico, nao suposicao.
//
// Sem DataHoraBaseAlteracaoInicial/ControlePaginacao: testado sem esses
// campos e o servico devolveu os 1539 produtos de Estoque Proprio numa
// unica chamada (~2s) - volume pequeno o bastante pra full refresh a cada
// sincronizacao ser mais simples e mais confiavel do que depender de
// paginacao/filtro incremental nao documentados/nao confirmados (mesma
// decisao ja tomada por NotaFiscalSyncStrategy, ver sync-strategy.interface.ts).
export interface LoginRadar {
  base: string;
  usuario: string;
  senha: string;
}

export function buildBuscarSaldoProdutoBody(login: LoginRadar) {
  return {
    login: {
      Base: login.base,
      Usuario: login.usuario,
      Senha: login.senha,
    },
    filtro: {
      EstoqueProprio: true,
      EstoquePoderTerceiros: false,
      EstoqueTerceiroPoderEmpresa: false,
      ListarProdutosSubordinados: false,
    },
  };
}
