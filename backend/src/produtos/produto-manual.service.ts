import { parse as parseCaminho } from 'node:path';
import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutoImagemStorageService } from './produto-imagem-storage.service';
import type { AtualizarProdutoManualDto } from './dto/atualizar-produto-manual.dto';
import { paraProdutoDetalheDto, type ProdutoDetalheDto } from './dto/produto-response.dto';

// Whitelist explicita (checklist de seguranca "5. XSS/input sem
// tratamento" - validacao real de upload por MIME/tamanho) - so imagem,
// mesmo criterio de TIPOS_MIME_PERMITIDOS em documentos.service.ts.
export const TIPOS_MIME_IMAGEM_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const TAMANHO_MAXIMO_IMAGEM_BYTES = 5 * 1024 * 1024;
// Limite de arquivos por chamada de upload em massa - nao tecnico
// (Multer/Node aguentam mais), so' pra manter uma leva de import em massa
// num tamanho revisavel; acima disso, o admin faz em mais de uma leva.
export const MAXIMO_ARQUIVOS_LOTE = 300;

export interface ResultadoImagensLoteDto {
  aplicados: { codigo: string; produtoId: string }[];
  naoEncontrados: string[];
  ambiguos: string[];
  invalidos: { codigo: string; motivo: string }[];
}

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

    // null explicito = "limpar a associacao" (nunca validado contra o
    // catalogo - so um id de verdade precisa existir/estar ativo);
    // undefined = campo nao enviado nesta chamada, PATCH parcial.
    if (dto.tipoAcondicionamentoId) {
      await this.validarTipoAcondicionamento(dto.tipoAcondicionamentoId);
    }

    const atualizado = await this.prisma.produto.update({
      where: { id: produto.id },
      data: {
        precoFabricacao: dto.precoFabricacao,
        tipoAcondicionamentoId: dto.tipoAcondicionamentoId,
      },
    });
    return paraProdutoDetalheDto(atualizado);
  }

  // 422 (nao 404) - o recurso que "nao existe" aqui e' um VALOR dentro do
  // body, nao a URL, mesmo criterio ja usado pra erro de validacao de
  // negocio no projeto.
  private async validarTipoAcondicionamento(tipoAcondicionamentoId: string): Promise<void> {
    const tipo = await this.prisma.tipoAcondicionamento.findUnique({
      where: { id: tipoAcondicionamentoId },
    });
    if (!tipo || !tipo.ativo) {
      throw new UnprocessableEntityException(
        `Tipo de acondicionamento '${tipoAcondicionamentoId}' não encontrado ou inativo`,
      );
    }
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

  // Upload em massa (pedido do usuario, 2026-09-29): nome do arquivo (sem
  // extensao) = Produto.codigo. Regras confirmadas com o usuario:
  // - codigo sem produto nenhum -> "naoEncontrados", nada aplicado;
  // - codigo com MAIS de um produto (codigo nao e' @unique no schema,
  //   confirmado - dois produtos podem compartilhar o mesmo codigo
  //   comercial) -> "ambiguos", nenhum dos dois recebe a imagem (evita
  //   aplicar a imagem errada silenciosamente);
  // - produto que ja tem imagem -> sobrescreve sem perguntar, mesmo
  //   comportamento do upload individual (salvarImagem acima).
  // Sequencial (nao Promise.all) de proposito - dezenas/centenas de
  // arquivos em paralelo disputariam o pool de conexoes do Prisma e o
  // disco a toa; upload em lote nao e' um caminho sensivel a latencia por
  // arquivo do jeito que uma API teria que ser.
  async salvarImagensEmLote(
    arquivos: Express.Multer.File[],
  ): Promise<ResultadoImagensLoteDto> {
    const resultado: ResultadoImagensLoteDto = {
      aplicados: [],
      naoEncontrados: [],
      ambiguos: [],
      invalidos: [],
    };

    for (const arquivo of arquivos) {
      const codigo = parseCaminho(arquivo.originalname).name;

      if (
        !TIPOS_MIME_IMAGEM_PERMITIDOS.includes(
          arquivo.mimetype as (typeof TIPOS_MIME_IMAGEM_PERMITIDOS)[number],
        )
      ) {
        resultado.invalidos.push({
          codigo,
          motivo: `Tipo de arquivo não permitido: ${arquivo.mimetype}`,
        });
        continue;
      }

      const candidatos = await this.prisma.produto.findMany({
        where: { codigo },
      });
      if (candidatos.length === 0) {
        resultado.naoEncontrados.push(codigo);
        continue;
      }
      if (candidatos.length > 1) {
        resultado.ambiguos.push(codigo);
        continue;
      }

      const produto = candidatos[0];
      const caminhoAntigo = produto.imagemCaminho;
      const novoCaminho = await this.imagemStorage.salvar(
        arquivo.buffer,
        arquivo.originalname,
      );
      await this.prisma.produto.update({
        where: { id: produto.id },
        data: { imagemCaminho: novoCaminho, imagemTipoMime: arquivo.mimetype },
      });
      if (caminhoAntigo) {
        await this.imagemStorage.remover(caminhoAntigo);
      }

      resultado.aplicados.push({ codigo, produtoId: produto.id });
    }

    return resultado;
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
