// Corpo da requisicao pra Empresarial.svc/json/BuscarTabelasPreco - JSON
// puro (mesma assimetria ja documentada em build-buscar-saldo-produto-body.ts:
// o nome do servico e o WSDL classico sugerem SOAP, mas o binding real
// aceita JSON, confirmado empiricamente).
//
// filtro:{} (sem Codigo) confirmado empiricamente que traz TODAS as
// tabelas ativas numa chamada so - por isso o sync (TabelaPrecoSyncStrategy)
// nunca passa `codigo`, sempre full refresh de tudo. O parametro existe
// aqui so' pra permitir uma consulta pontual por codigo especifico no
// futuro, sem reescrever o builder.
export interface LoginRadar {
  base: string;
  usuario: string;
  senha: string;
}

export function buildBuscarTabelasPrecoBody(login: LoginRadar, codigo?: string) {
  return {
    login: {
      Base: login.base,
      Usuario: login.usuario,
      Senha: login.senha,
    },
    filtro: codigo ? { Codigo: codigo } : {},
  };
}
