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
    return this.resolverEscopo(idpUser, usuarioId);
  }

  // Mesma resolucao de EscopoClientes (papel + equipe), so com outro nome
  // no call site (OS-BACKEND-22/OS-WEB-21) - "quais vendedores este usuario
  // enxerga" e' identico pra filtrar Cliente ou SolicitacaoDesconto por
  // vendedorSolicitanteId, so o `construirWhere*PorEscopo` que muda por
  // entidade (ver solicitacoes-desconto.service.ts). Evita duplicar a
  // resolucao (papel/BFS) num segundo metodo so por causa do nome.
  async resolverEscopoVendedores(
    idpUser: IdpUser,
    usuarioId: string,
  ): Promise<EscopoClientes> {
    return this.resolverEscopo(idpUser, usuarioId);
  }

  private async resolverEscopo(
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

    // OS-BACKEND-48 - carteiras cobertas temporariamente (ferias/licenca)
    // se somam ao escopo normal, nunca o substituem - reaproveita EQUIPE
    // (ja significa "mais de um vendedor"), sem precisar mudar o contrato
    // de EscopoClientes usado em todo lugar que consome escopo.
    const cobertos = await this.obterVendedorIdsCobertos(vendedor.id);

    if (vendedor.papel === 'SUPERVISOR' || vendedor.papel === 'GERENTE') {
      const vendedorIds = await this.coletarEquipe(vendedor.id);
      const uniao = new Set([...vendedorIds, ...cobertos]);
      return { tipo: 'EQUIPE', vendedorIds: [...uniao] };
    }

    if (cobertos.length > 0) {
      return { tipo: 'EQUIPE', vendedorIds: [vendedor.id, ...cobertos] };
    }

    return { tipo: 'PROPRIO', vendedorId: vendedor.id };
  }

  // Coberturas ATIVAS agora (dataInicio <= agora <= dataFim) em que este
  // vendedor e' o SUBSTITUTO - o fim da cobertura e' so' a passagem de
  // dataFim, nenhum job precisa "desligar" nada.
  private async obterVendedorIdsCobertos(vendedorSubstitutoId: string): Promise<string[]> {
    const agora = new Date();
    const coberturas = await this.prisma.coberturaTemporaria.findMany({
      where: {
        vendedorSubstitutoId,
        dataInicio: { lte: agora },
        dataFim: { gte: agora },
      },
      select: { vendedorOriginalId: true },
    });
    return coberturas.map((c) => c.vendedorOriginalId);
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
