import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SegredoCryptoService } from '../common/crypto/segredo-crypto.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ChaveLlmDto {
  id: string;
  rotulo: string;
  // Preview mascarado (so os 4 ultimos caracteres, ex: "••••ab12") -
  // apiKey crua NUNCA sai daqui, nem em GET admin (mesmo criterio de
  // ConfiguracaoLlmService com a chave unica antiga).
  chavePreview: string;
  ordem: number;
  ativa: boolean;
  atualizadoEm: string;
}

export interface CriarChaveLlmInput {
  rotulo: string;
  apiKey: string;
}

export interface AtualizarChaveLlmInput {
  rotulo?: string;
  ativa?: boolean;
}

// 2026-09-24 - multiplas chaves de API de LLM com fallback em cadeia
// (pedido explicito do usuario: "lista de fallback, caso uma chave nao
// responda, cai pra proxima... podendo arrastar pra cima/baixo pra alterar
// a ordem"). Aba "LLM" da tela de Configuracoes (ver
// configuracoes.module.ts) - reordenacao manda a LISTA INTEIRA de ids na
// nova ordem (drag-and-drop no client), nao um swap de dois.
@Injectable()
export class ChaveLlmService {
  private readonly logger = new Logger(ChaveLlmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly segredoCrypto: SegredoCryptoService,
  ) {}

  async listar(): Promise<ChaveLlmDto[]> {
    const chaves = await this.prisma.chaveLlm.findMany({ orderBy: { ordem: 'asc' } });
    return chaves.map((chave) => this.paraDto(chave));
  }

  async criar(input: CriarChaveLlmInput): Promise<ChaveLlmDto> {
    const maiorOrdem = await this.prisma.chaveLlm.aggregate({ _max: { ordem: true } });
    const criada = await this.prisma.chaveLlm.create({
      data: {
        rotulo: input.rotulo,
        apiKey: this.segredoCrypto.criptografar(input.apiKey),
        ordem: (maiorOrdem._max.ordem ?? -1) + 1,
      },
    });
    return this.paraDto(criada);
  }

  async atualizar(id: string, input: AtualizarChaveLlmInput): Promise<ChaveLlmDto> {
    await this.garantirExiste(id);
    const atualizada = await this.prisma.chaveLlm.update({
      where: { id },
      data: { rotulo: input.rotulo, ativa: input.ativa },
    });
    return this.paraDto(atualizada);
  }

  async remover(id: string): Promise<void> {
    await this.garantirExiste(id);
    await this.prisma.chaveLlm.delete({ where: { id } });
  }

  // ids fora de qualquer chave existente sao ignorados (nunca falha por
  // isso); chave existente omitida da lista mantem a ordem atual (nunca
  // apagada/perdida por uma reordenacao parcial vinda do client).
  async reordenar(ids: string[]): Promise<ChaveLlmDto[]> {
    await this.prisma.$transaction(
      ids.map((id, indice) =>
        this.prisma.chaveLlm.updateMany({ where: { id }, data: { ordem: indice } }),
      ),
    );
    return this.listar();
  }

  // Uso interno do LlmClientService - unico lugar que le a apiKey crua
  // (decifrada), ja em ordem de fallback (so as ativas). Chave que nao
  // descriptografa mais (corrompida/cifrada com uma SEGREDO_CRYPTO_KEY
  // antiga) e' pulada com um warning, nunca quebra o fallback inteiro -
  // mesmo criterio ja usado pra ConfiguracaoLlm.apiKey antes desta OS.
  async listarCredenciaisAtivas(): Promise<{ id: string; apiKey: string }[]> {
    const chaves = await this.prisma.chaveLlm.findMany({
      where: { ativa: true },
      orderBy: { ordem: 'asc' },
    });

    const credenciais: { id: string; apiKey: string }[] = [];
    for (const chave of chaves) {
      const decifrada = this.descriptografarComFallback(chave.apiKey, chave.id);
      if (decifrada) {
        credenciais.push({ id: chave.id, apiKey: decifrada });
      }
    }
    return credenciais;
  }

  private async garantirExiste(id: string): Promise<void> {
    const chave = await this.prisma.chaveLlm.findUnique({ where: { id } });
    if (!chave) {
      throw new NotFoundException(`Chave '${id}' não encontrada`);
    }
  }

  private descriptografarComFallback(apiKeyCifrada: string, chaveId: string): string | null {
    try {
      return this.segredoCrypto.descriptografar(apiKeyCifrada);
    } catch (error) {
      this.logger.warn(
        `Falha ao descriptografar ChaveLlm '${chaveId}' (dado legado ou corrompido) - pulando na cadeia de fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private paraDto(chave: {
    id: string;
    rotulo: string;
    apiKey: string;
    ordem: number;
    ativa: boolean;
    atualizadoEm: Date;
  }): ChaveLlmDto {
    return {
      id: chave.id,
      rotulo: chave.rotulo,
      chavePreview: this.mascarar(chave.apiKey, chave.id),
      ordem: chave.ordem,
      ativa: chave.ativa,
      atualizadoEm: chave.atualizadoEm.toISOString(),
    };
  }

  private mascarar(apiKeyCifrada: string, chaveId: string): string {
    const decifrada = this.descriptografarComFallback(apiKeyCifrada, chaveId);
    if (!decifrada) {
      return '(chave ilegível)';
    }
    return decifrada.length <= 4 ? '••••' : `••••${decifrada.slice(-4)}`;
  }
}
