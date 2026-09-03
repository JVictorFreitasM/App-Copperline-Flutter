import type { LoginRadar } from '../estoque-svc-client/build-buscar-saldo-produto-body';
import type { FiltroCobrancaContaReceber } from './financeiro-svc-client.types';

// Corpo JSON pra Financeiro.svc/json/BuscarTokenBoleto (OS-BACKEND-43) -
// mesma assimetria ja documentada em build-buscar-posicao-financeira-body.ts.
export function buildBuscarTokenBoletoBody(
  login: LoginRadar,
  filtro: FiltroCobrancaContaReceber,
) {
  return {
    login: {
      Base: login.base,
      Usuario: login.usuario,
      Senha: login.senha,
    },
    filtro: {
      CodigoClienteSacado: filtro.CodigoClienteSacado,
      NumeroDocumento: filtro.NumeroDocumento,
    },
  };
}
