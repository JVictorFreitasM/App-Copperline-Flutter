import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SegredoCryptoService } from '../common/crypto/segredo-crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FORMATOS_POR_TIPO,
  TIPOS_PROVEDOR_API,
  type ProvedorApiAtivo,
  type ProvedorApiDto,
  type TipoProvedorApi,
} from './provedor-api.types';

export interface CriarProvedorApiInput {
  tipo: TipoProvedorApi;
  formato: string;
  rotulo: string;
  urlBase: string;
  token?: string;
  limiteRequisicoes?: number;
  janelaSegundos?: number;
}

export interface AtualizarProvedorApiInput {
  rotulo?: string;
  urlBase?: string;
  // undefined = mantem; "" = remove o token.
  token?: string;
  // null = sem limite proprio.
  limiteRequisicoes?: number | null;
  janelaSegundos?: number | null;
  ativa?: boolean;
}

interface LinhaProvedor {
  id: string;
  tipo: string;
  formato: string;
  rotulo: string;
  urlBase: string;
  token: string | null;
  limiteRequisicoes: number | null;
  janelaSegundos: number | null;
  ordem: number;
  ativa: boolean;
}

// Endpoints das APIs externas de consulta (CEP, CNPJ, mapas) editaveis pelo
// painel, com varios por tipo e fallback em cadeia: a ordem da lista e' a ordem
// de tentativa (mesmo desenho das chaves de LLM). Primeira subida: cada tipo sem
// nenhuma linha recebe os provedores que ja usavamos (URLs/token/limites das env
// vars antigas viram so' o valor inicial). Token cifrado com SegredoCryptoService.
@Injectable()
export class ProvedoresApiService implements OnModuleInit {
  private readonly logger = new Logger(ProvedoresApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly segredoCrypto: SegredoCryptoService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      for (const tipo of TIPOS_PROVEDOR_API) {
        const existentes = await this.prisma.provedorApi.count({ where: { tipo } });
        if (existentes > 0) continue;
        for (const [indice, padrao] of this.padroes(tipo).entries()) {
          await this.prisma.provedorApi.create({
            data: {
              tipo,
              formato: padrao.formato,
              rotulo: padrao.rotulo,
              urlBase: padrao.urlBase,
              token: padrao.token ? this.segredoCrypto.criptografar(padrao.token) : null,
              limiteRequisicoes: padrao.limiteRequisicoes ?? null,
              janelaSegundos: padrao.janelaSegundos ?? null,
              ordem: indice,
            },
          });
        }
      }
    } catch (erro) {
      this.logger.error(`Falha ao criar os provedores de API padrao: ${String(erro)}`);
    }
  }

  async listar(): Promise<ProvedorApiDto[]> {
    const linhas = await this.prisma.provedorApi.findMany({ orderBy: [{ tipo: 'asc' }, { ordem: 'asc' }] });
    return linhas.map(paraDto);
  }

  // Cadeia de tentativa de um tipo: so' ativos, em ordem, com token decifrado.
  async cadeia(tipo: TipoProvedorApi): Promise<ProvedorApiAtivo[]> {
    const linhas = await this.prisma.provedorApi.findMany({
      where: { tipo, ativa: true },
      orderBy: { ordem: 'asc' },
    });
    return linhas.map((linha) => ({
      id: linha.id,
      tipo: linha.tipo as TipoProvedorApi,
      formato: linha.formato,
      rotulo: linha.rotulo,
      urlBase: linha.urlBase,
      token: linha.token ? this.decifrar(linha) : null,
      limiteRequisicoes: linha.limiteRequisicoes,
      janelaSegundos: linha.janelaSegundos,
    }));
  }

  async criar(input: CriarProvedorApiInput): Promise<ProvedorApiDto> {
    if (!FORMATOS_POR_TIPO[input.tipo]?.includes(input.formato)) {
      throw new BadRequestException(`Formato ${input.formato} não existe para ${input.tipo}`);
    }
    const maior = await this.prisma.provedorApi.aggregate({
      where: { tipo: input.tipo },
      _max: { ordem: true },
    });
    const criado = await this.prisma.provedorApi.create({
      data: {
        tipo: input.tipo,
        formato: input.formato,
        rotulo: input.rotulo.trim(),
        urlBase: normalizarUrl(input.urlBase),
        token: input.token?.trim() ? this.segredoCrypto.criptografar(input.token.trim()) : null,
        limiteRequisicoes: input.limiteRequisicoes ?? null,
        janelaSegundos: input.janelaSegundos ?? null,
        ordem: (maior._max.ordem ?? -1) + 1,
      },
    });
    return paraDto(criado);
  }

  async atualizar(id: string, input: AtualizarProvedorApiInput): Promise<ProvedorApiDto> {
    await this.garantirExiste(id);
    const atualizado = await this.prisma.provedorApi.update({
      where: { id },
      data: {
        rotulo: input.rotulo?.trim(),
        urlBase: input.urlBase === undefined ? undefined : normalizarUrl(input.urlBase),
        token:
          input.token === undefined
            ? undefined
            : input.token.trim() === ''
              ? null
              : this.segredoCrypto.criptografar(input.token.trim()),
        limiteRequisicoes: input.limiteRequisicoes,
        janelaSegundos: input.janelaSegundos,
        ativa: input.ativa,
      },
    });
    return paraDto(atualizado);
  }

  async remover(id: string): Promise<void> {
    await this.garantirExiste(id);
    await this.prisma.provedorApi.delete({ where: { id } });
  }

  // Lista inteira de ids do tipo na nova ordem (mesmo contrato das chaves de
  // LLM): ids de outro tipo/inexistentes sao ignorados; omitido mantem a ordem.
  async reordenar(tipo: TipoProvedorApi, ids: string[]): Promise<ProvedorApiDto[]> {
    await this.prisma.$transaction(
      ids.map((id, indice) =>
        this.prisma.provedorApi.updateMany({ where: { id, tipo }, data: { ordem: indice } }),
      ),
    );
    const linhas = await this.prisma.provedorApi.findMany({ where: { tipo }, orderBy: { ordem: 'asc' } });
    return linhas.map(paraDto);
  }

  private async garantirExiste(id: string): Promise<void> {
    const existe = await this.prisma.provedorApi.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('Provedor não encontrado');
  }

  private decifrar(linha: LinhaProvedor): string | null {
    try {
      return this.segredoCrypto.descriptografar(linha.token as string);
    } catch {
      this.logger.error(`Token do provedor ${linha.rotulo} ilegivel - seguindo sem token`);
      return null;
    }
  }

  private padroes(tipo: TipoProvedorApi): {
    formato: string;
    rotulo: string;
    urlBase: string;
    token?: string;
    limiteRequisicoes?: number;
    janelaSegundos?: number;
  }[] {
    const env = (chave: string) => this.configService.get<string>(chave);
    switch (tipo) {
      case 'CEP':
        return [
          {
            formato: 'MILEENA',
            rotulo: 'Mileena (CEP)',
            urlBase: env('CEP_API_URL') ?? 'https://mileena.opencaramelo.com/cep',
          },
          { formato: 'VIACEP', rotulo: 'ViaCEP (reserva)', urlBase: 'https://viacep.com.br/ws' },
        ];
      case 'CNPJ':
        return [
          {
            formato: 'RECEITAWS',
            rotulo: 'ReceitaWS',
            urlBase: env('RECEITAWS_API_URL') ?? 'https://receitaws.com.br/v1/cnpj',
            token: env('RECEITAWS_TOKEN') || undefined,
            // Plano gratis: 3 consultas por MINUTO (medido em 2026-10-06).
            limiteRequisicoes: Number(env('RECEITAWS_LIMITE') ?? 3),
            janelaSegundos: Number(env('RECEITAWS_JANELA_SEGUNDOS') ?? 60),
          },
          {
            formato: 'BRASILAPI',
            rotulo: 'BrasilAPI (reserva)',
            urlBase: env('BRASILAPI_CNPJ_URL') ?? 'https://brasilapi.com.br/api/cnpj/v1',
          },
        ];
      case 'GEOCODIFICACAO':
        return [
          {
            formato: 'NOMINATIM',
            rotulo: 'OpenStreetMap Nominatim',
            urlBase: env('GEOCODIFICACAO_API_URL') ?? 'https://nominatim.openstreetmap.org/search',
          },
        ];
    }
  }
}

function paraDto(linha: LinhaProvedor): ProvedorApiDto {
  return {
    id: linha.id,
    tipo: linha.tipo as TipoProvedorApi,
    formato: linha.formato,
    rotulo: linha.rotulo,
    urlBase: linha.urlBase,
    tokenDefinido: linha.token !== null,
    limiteRequisicoes: linha.limiteRequisicoes,
    janelaSegundos: linha.janelaSegundos,
    ordem: linha.ordem,
    ativa: linha.ativa,
  };
}

function normalizarUrl(url: string): string {
  const limpa = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/i.test(limpa)) {
    throw new BadRequestException('URL inválida - use http:// ou https://');
  }
  return limpa;
}
