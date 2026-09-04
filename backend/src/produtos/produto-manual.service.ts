import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutoImagemStorageService } from './produto-imagem-storage.service';
import type { AtualizarProdutoManualDto } from './dto/atualizar-produto-manual.dto';
import { paraProdutoDetalheDto, type ProdutoDetalheDto } from './dto/produto-response.dto';

// Whitelist explicita (checklist de seguranca "5. XSS/input sem
// tratamento" - validacao real de upload por MIME/tamanho) - so imagem,
// mesmo criterio de TIPOS_MIME_PERMITIDOS em documentos.service.ts.
export const TIPOS_MIME_IMAGEM_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const TAMANHO_MAXIMO_IMAGEM_BYTES = 5 * 1024 * 1024;

// Campos de Produto que NAO vem do WK Radar (precoFabricacao,
// imagemCaminho/imagemTipoMime) - fora do escopo de produto.sync.ts de
// proposito, por isso um service separado em vez de estender
// ProdutosService (que so' le/orquestra dado sincronizado).
@Injectable()
export class ProdutoManualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagemStorage: ProdutoImagemStorageService,
  ) {}

  async atualizar(
    produtoId: string,
    dto: AtualizarProdutoManualDto,
  ): Promise<ProdutoDetalheDto> {
    const produto = await this.obterOuFalhar(produtoId);
    const atualizado = await this.prisma.produto.update({
      where: { id: produto.id },
      data: { precoFabricacao: dto.precoFabricacao },
    });
    return paraProdutoDetalheDto(atualizado);
  }

  async salvarImagem(
    produtoId: string,
    arquivo: Express.Multer.File,
  ): Promise<ProdutoDetalheDto> {
    if (!TIPOS_MIME_IMAGEM_PERMITIDOS.includes(arquivo.mimetype as (typeof TIPOS_MIME_IMAGEM_PERMITIDOS)[number])) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${arquivo.mimetype}`,
      );
    }
    const produto = await this.obterOuFalhar(produtoId);

    const caminhoAntigo = produto.imagemCaminho;
    const novoCaminho = await this.imagemStorage.salvar(
      arquivo.buffer,
      arquivo.originalname,
    );

    const atualizado = await this.prisma.produto.update({
      where: { id: produto.id },
      data: { imagemCaminho: novoCaminho, imagemTipoMime: arquivo.mimetype },
    });

    // So remove o arquivo antigo do disco DEPOIS do update confirmado -
    // uma falha no meio nunca deixa o produto sem imagem nenhuma.
    if (caminhoAntigo) {
      await this.imagemStorage.remover(caminhoAntigo);
    }

    return paraProdutoDetalheDto(atualizado);
  }

  async obterImagem(
    produtoId: string,
  ): Promise<{ buffer: Buffer; tipoMime: string }> {
    const produto = await this.obterOuFalhar(produtoId);
    if (!produto.imagemCaminho || !produto.imagemTipoMime) {
      throw new NotFoundException(
        `Produto '${produtoId}' não possui imagem cadastrada`,
      );
    }
    const buffer = await this.imagemStorage.ler(produto.imagemCaminho);
    return { buffer, tipoMime: produto.imagemTipoMime };
  }

  private async obterOuFalhar(produtoId: string) {
    const produto = await this.prisma.produto.findUnique({
      where: { id: produtoId },
    });
    if (!produto) {
      throw new NotFoundException(`Produto '${produtoId}' não encontrado`);
    }
    return produto;
  }
}
