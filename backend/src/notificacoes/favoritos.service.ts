import { Injectable, NotFoundException } from '@nestjs/common';
import { paraProdutoResumoDto } from '../produtos/dto/produto-response.dto';
import type { ProdutoResumoDto } from '../produtos/dto/produto-response.dto';
import { PrismaService } from '../prisma/prisma.service';

// Pre-requisito minimo pro alerta de "produto reabastecido" fazer sentido
// (OS-BACKEND-19, ver SaldoEstoqueSyncStrategy/NotificacaoDispatchService)
// - sem saber quem favoritou o que, nao ha como filtrar quem notificar.
@Injectable()
export class FavoritosService {
  constructor(private readonly prisma: PrismaService) {}

  async favoritar(usuarioId: string, produtoId: string): Promise<void> {
    await this.garantirProdutoExiste(produtoId);
    await this.prisma.produtoFavorito.upsert({
      where: { usuarioId_produtoId: { usuarioId, produtoId } },
      create: { usuarioId, produtoId },
      update: {},
    });
  }

  async desfavoritar(usuarioId: string, produtoId: string): Promise<void> {
    await this.prisma.produtoFavorito.deleteMany({
      where: { usuarioId, produtoId },
    });
  }

  async listar(usuarioId: string): Promise<ProdutoResumoDto[]> {
    const favoritos = await this.prisma.produtoFavorito.findMany({
      where: { usuarioId },
      include: { produto: true },
      orderBy: { criadoEm: 'desc' },
    });
    return favoritos.map((f) => paraProdutoResumoDto(f.produto));
  }

  private async garantirProdutoExiste(produtoId: string): Promise<void> {
    const produto = await this.prisma.produto.findUnique({ where: { id: produtoId } });
    if (!produto) {
      throw new NotFoundException(`Produto '${produtoId}' não encontrado`);
    }
  }
}
