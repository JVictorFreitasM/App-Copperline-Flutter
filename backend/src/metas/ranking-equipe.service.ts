import { ForbiddenException, Injectable } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { VendedorVendasService } from '../vendedores/vendedor-vendas.service';
import { ConfiguracaoGamificacaoService } from './configuracao-gamificacao.service';
import { filtroMes } from './filtro-mes';

export interface RankingEquipeItemDto {
  vendedorId: string;
  nome: string | null;
  valorVendido: number;
}

// OS-BACKEND-44 - GET /equipe/ranking?mesAno=. Quem enxerga o ranking de
// quem (regra de negocio, por isso vive aqui e nao no controller):
// - admin (role do IdP): ranking de todos os vendedores ativos.
// - SUPERVISOR/GERENTE: ranking da propria equipe (recursiva, mesma
//   resolucao de VendedorEscopoService.EQUIPE ja usada em Cliente/
//   SolicitacaoDesconto).
// - VENDEDOR comum: so' se ConfiguracaoGamificacao.rankingVisivelParaVendedor
//   estiver ligado - nesse caso, ranking dos COLEGAS da mesma equipe (mesmo
//   supervisorId), nao a equipe que ele gerencia (nao gerencia nenhuma).
// - Sem Vendedor vinculado: 403 (sem equipe nenhuma pra ver ranking, mesmo
//   criterio ja usado em SolicitacoesDescontoService.listarPendentes).
@Injectable()
export class RankingEquipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendedorEscopoService: VendedorEscopoService,
    private readonly vendedorVendasService: VendedorVendasService,
    private readonly configuracaoGamificacaoService: ConfiguracaoGamificacaoService,
  ) {}

  async obterParaUsuario(
    idpUser: IdpUser,
    usuarioId: string,
    mesAno: string,
  ): Promise<RankingEquipeItemDto[]> {
    const vendedorIds = await this.resolverVendedorIdsVisiveis(
      idpUser,
      usuarioId,
    );
    return this.montarRanking(vendedorIds, mesAno);
  }

  private async resolverVendedorIdsVisiveis(
    idpUser: IdpUser,
    usuarioId: string,
  ): Promise<string[]> {
    if (idpUser.role === 'admin') {
      const todos = await this.prisma.vendedor.findMany({
        where: { inativo: false },
        select: { id: true },
      });
      return todos.map((v) => v.id);
    }

    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
      select: { id: true, papel: true, supervisorId: true },
    });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário sem vendedor vinculado não tem equipe para ver ranking',
      );
    }

    if (vendedor.papel === 'SUPERVISOR' || vendedor.papel === 'GERENTE') {
      const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
        idpUser,
        usuarioId,
      );
      return escopo.tipo === 'EQUIPE' ? escopo.vendedorIds : [vendedor.id];
    }

    // VENDEDOR comum - so' com a flag ligada, e' ranking dos colegas (mesmo
    // supervisorId), nunca a equipe que ele "gerencia" (nao gerencia
    // nenhuma).
    const rankingVisivel =
      await this.configuracaoGamificacaoService.obterRankingVisivelParaVendedor();
    if (!rankingVisivel) {
      throw new ForbiddenException(
        'Ranking da equipe não está visível para o seu papel',
      );
    }
    if (!vendedor.supervisorId) {
      return [vendedor.id];
    }
    const colegas = await this.prisma.vendedor.findMany({
      where: { supervisorId: vendedor.supervisorId },
      select: { id: true },
    });
    return colegas.map((v) => v.id);
  }

  private async montarRanking(
    vendedorIds: string[],
    mesAno: string,
  ): Promise<RankingEquipeItemDto[]> {
    if (vendedorIds.length === 0) {
      return [];
    }

    const [valores, vendedores] = await Promise.all([
      this.vendedorVendasService.valorVendidoPorVendedor(filtroMes(mesAno)),
      this.prisma.vendedor.findMany({
        where: { id: { in: vendedorIds } },
        select: { id: true, nome: true },
      }),
    ]);

    return vendedores
      .map((v) => ({
        vendedorId: v.id,
        nome: v.nome,
        valorVendido: valores.get(v.id) ?? 0,
      }))
      .sort((a, b) => b.valorVendido - a.valorVendido);
  }
}
