import type { ClienteResumoDto } from "./clientes";
import type { ProdutoResumoDto } from "./produtos";
import type { PedidoResumoDto } from "./pedidos";

// Mesmo shape de backend/src/busca/dto/busca-resultado.dto.ts
// (BuscaResultadoDto) - consome GET /busca (OS-BACKEND-18), já existente
// no backend mas sem tela de resultado no web até agora (o campo de busca
// da Topbar era só visual, `disabled`).
export interface BuscaResultadoDto {
  clientes: ClienteResumoDto[];
  produtos: ProdutoResumoDto[];
  pedidos: PedidoResumoDto[];
}
