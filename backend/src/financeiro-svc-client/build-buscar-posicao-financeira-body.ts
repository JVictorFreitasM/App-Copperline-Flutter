import type { LoginRadar } from '../estoque-svc-client/build-buscar-saldo-produto-body';

// Corpo JSON pra Financeiro.svc/json/BuscarPosicaoFinanceira - mesma
// assimetria ja documentada em build-buscar-saldo-produto-body.ts
// (Estoque.svc): o WSDL classico sugere SOAP/XML, mas o binding real desta
// instalacao aceita JSON no request. `Codigo` (dentro de filtro) e' o
// identificador do cliente/conta no Radar - ConsiderarTitulos:true pra
// garantir que os valores de saldo a vencer/vencido venham calculados
// (ver PosicaoFinanceira no WSDL).
export function buildBuscarPosicaoFinanceiraBody(
  login: LoginRadar,
  codigoCliente: string,
) {
  return {
    login: {
      Base: login.base,
      Usuario: login.usuario,
      Senha: login.senha,
    },
    filtro: {
      Codigo: codigoCliente,
      ConsiderarTitulos: true,
      ConsiderarData: false,
      ConsiderarEmpresas: false,
      ConsiderarFiliais: false,
    },
  };
}
