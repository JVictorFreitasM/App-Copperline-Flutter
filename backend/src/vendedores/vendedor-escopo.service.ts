import { Injectable } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Escopo de acesso a dado de cliente por vendedor (OS-BACKEND-23):
// - TODOS: admin do IdP (role de SISTEMA, ver skill idp-client - nao e' o
//   mesmo conceito de PapelVendedor/hierarquia de vendas da OS-BACKEND-22).
//   Cobre operacao/suporte que precisa ver tudo mas nao e necessariamente
//   um vendedor cadastrado.
// - EQUIPE: SUPERVISOR/GERENTE (PapelVendedor) - ve a propria carteira +
//   a de todo mundo abaixo na hierarquia (subordinados, recursivo).
// - PROPRIO: VENDEDOR comum - so a propria carteira.
// - NENHUM: usuario autenticado mas sem Vendedor vinculado (nunca logou
//   como vendedor, ou nao e vendedor) e sem role admin - fail-closed, nao
//   mostra nada em vez de assumir acesso total.
export type EscopoClientes =
  | { tipo: 'TODOS' }
  | { tipo: 'EQUIPE'; vendedorIds: string[] }
  | { tipo: 'PROPRIO'; vendedorId: string }
  | { tipo: 'NENHUM' };

// Filtro Prisma equivalente a um EscopoClientes - compartilhado entre
// ClientesService (listar/buscarPorId) e ClienteResumoLlmService, pra
// aplicar a MESMA regra de escopo em todo lugar que expoe dado de cliente
// por id (criterio de aceite: "em nenhum endpoint" um vendedor ve cliente
// de outro alem do check de conflito - ver clientes.controller.ts). null
// significa "nenhum cliente nunca bate" (escopo NENHUM) - quem chama deve
// tratar isso como 404 sem nem consultar o banco.
export function construirWhereClientePorEscopo(
  escopo: EscopoClientes,
): Prisma.ClienteWhereInput | null {
  switch (escopo.tipo) {
    case 'TODOS':
      return {};
    case 'PROPRIO':
      return { vendedores: { some: { vendedorId: escopo.vendedorId } } };
    case 'EQUIPE':
      return { vendedores: { some: { vendedorId: { in: escopo.vendedorIds } } } };
    case 'NENHUM':
      return null;
  }
}

@Injectable()
export class VendedorEscopoService {
  constructor(private readonly prisma: PrismaService) {}

  async resolverEscopoClientes(
    idpUser: IdpUser,
    usuarioId: string,
  ): Promise<EscopoClientes> {
    if (idpUser.role === 'admin') {
      return { tipo: 'TODOS' };
    }

    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
      select: { id: true, papel: true },
    });
    if (!vendedor) {
      return { tipo: 'NENHUM' };
    }

    if (vendedor.papel === 'SUPERVISOR' || vendedor.papel === 'GERENTE') {
      const vendedorIds = await this.coletarEquipe(vendedor.id);
      return { tipo: 'EQUIPE', vendedorIds };
    }

    return { tipo: 'PROPRIO', vendedorId: vendedor.id };
  }

  // BFS por nivel via supervisorId (Vendedor.subordinados) - inclui o
  // proprio vendedor (supervisor/gerente pode ter carteira propria alem da
  // equipe). Uma query por nivel em vez de uma por vendedor - hierarquia
  // tipicamente rasa (VENDEDOR/SUPERVISOR/GERENTE), poucos niveis.
  private async coletarEquipe(vendedorId: string): Promise<string[]> {
    const equipe = new Set<string>([vendedorId]);
    let nivelAtual = [vendedorId];

    while (nivelAtual.length > 0) {
      const subordinados = await this.prisma.vendedor.findMany({
        where: { supervisorId: { in: nivelAtual } },
        select: { id: true },
      });
      const novos = subordinados
        .map((v) => v.id)
        .filter((id) => !equipe.has(id));
      novos.forEach((id) => equipe.add(id));
      nivelAtual = novos;
    }

    return [...equipe];
  }
}
