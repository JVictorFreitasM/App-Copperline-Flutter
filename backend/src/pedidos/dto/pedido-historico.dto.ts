import type { PedidoHistoricoStatus, Usuario } from '../../../generated/prisma/client';

// GET /pedidos/:id/historico (OS-BACKEND-33) - alteradoPor sempre resolve
// pro nome do usuario quando ha um (nunca "sistema" generico quando existe
// ator identificavel, ver criterio de aceite) - null so pra uma transicao
// sem ator humano (nenhuma implementada ainda, mas o campo e' nullable no
// schema pra esse caso futuro).
export interface PedidoHistoricoStatusDto {
  id: string;
  statusAnterior: string | null;
  statusNovo: string;
  alteradoPor: { id: string; nome: string } | null;
  alteradoEm: string;
}

export function paraPedidoHistoricoStatusDto(
  registro: PedidoHistoricoStatus & { usuario: Usuario | null },
): PedidoHistoricoStatusDto {
  return {
    id: registro.id,
    statusAnterior: registro.statusAnterior,
    statusNovo: registro.statusNovo,
    alteradoPor: registro.usuario
      ? { id: registro.usuario.id, nome: registro.usuario.nome }
      : null,
    alteradoEm: registro.alteradoEm.toISOString(),
  };
}
