import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

// Subconjunto minimo de um documento OpenAPI 3.x que este importador
// entende - so o suficiente pra achar o schema de resposta de um GET e
// resolver $ref uma vez (sem $ref aninhado em cadeia, ver limitacoes no
// header da classe abaixo).
interface OpenApiSchema {
  type?: string;
  format?: string;
  nullable?: boolean;
  $ref?: string;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
}

interface OpenApiDocument {
  paths?: Record<
    string,
    { get?: { responses?: Record<string, { content?: Record<string, { schema?: OpenApiSchema }> }> } }
  >;
  components?: { schemas?: Record<string, OpenApiSchema> };
}

interface CampoInferido {
  nomeCampo: string;
  nomeColunaSnakeCase: string;
  suportado: boolean;
  tipoPrisma: string;
  tipoTypeScript: string;
  linhaMap: string;
}

export interface ImportarSwaggerResultado {
  nomeEntidade: string;
  avisoRevisaoNecessaria: true;
  modeloPrismaRascunho: string;
  syncStrategyRascunho: string;
  camposNaoMapeados: string[];
}

// OS-BACKEND-30 - reduz o trabalho de mapear campo a campo ao integrar uma
// nova entidade do ERP, gerando um RASCUNHO (nunca aplicado sozinho) de
// model Prisma + SyncStrategy a partir do Swagger/OpenAPI do Radar.
//
// Limitacoes deliberadas (documentadas, nao bugs):
// - So GET e' considerado (sync sempre le do ERP, nunca escreve - ver
//   CLAUDE.md "Direção do fluxo e' unidirecional").
// - So response 200 com content application/json e' resolvido.
// - $ref e' resolvido UMA vez (schema raiz ou schema de array de $ref) -
//   suficiente pros DTOs do Radar confirmados ate agora (ReadXDto direto
//   ou array de ReadXDto), nao uma cadeia de $ref->$ref->$ref.
// - Campo aninhado (object) ou array de objeto fica marcado como
//   "TODO: revisar" em vez de tentar achatar automaticamente - decidir se
//   isso vira tabela relacionada (como ContatoCliente) ou JSONB (como
//   Cliente.enderecos) e' julgamento humano (ver Fora de escopo da OS).
// - Cursor incremental e chave de dedup NUNCA sao inferidos - sempre
//   "TODO: revisar" no rascunho (Fora de escopo explicito da OS).
@Injectable()
export class SwaggerImportService {
  constructor(private readonly httpService: HttpService) {}

  async importar(
    swaggerUrl: string,
    caminhoEndpoint: string,
    nomeEntidade: string,
  ): Promise<ImportarSwaggerResultado> {
    const documento = await this.baixarDocumento(swaggerUrl);
    const schema = this.resolverSchemaDeResposta(documento, caminhoEndpoint);

    const propriedades = schema.properties ?? {};
    const campos = Object.entries(propriedades).map(([nomeCampo, propSchema]) =>
      this.inferirCampo(nomeCampo, propSchema),
    );

    const camposNaoMapeados = campos
      .filter((campo) => !campo.suportado)
      .map((campo) => campo.nomeCampo);

    return {
      nomeEntidade,
      avisoRevisaoNecessaria: true,
      modeloPrismaRascunho: this.gerarModeloPrisma(nomeEntidade, campos),
      syncStrategyRascunho: this.gerarSyncStrategy(nomeEntidade, caminhoEndpoint, campos),
      camposNaoMapeados,
    };
  }

  private async baixarDocumento(swaggerUrl: string): Promise<OpenApiDocument> {
    const resposta = await firstValueFrom(
      this.httpService.get<OpenApiDocument>(swaggerUrl, { timeout: 30_000 }),
    );
    if (!resposta.data.paths) {
      throw new BadRequestException(
        'Documento retornado nao parece um OpenAPI valido (sem "paths")',
      );
    }
    return resposta.data;
  }

  private resolverSchemaDeResposta(
    documento: OpenApiDocument,
    caminhoEndpoint: string,
  ): OpenApiSchema {
    const schemaBruto =
      documento.paths?.[caminhoEndpoint]?.get?.responses?.['200']?.content?.[
        'application/json'
      ]?.schema;
    if (!schemaBruto) {
      throw new BadRequestException(
        `Nao foi possivel achar o schema de resposta 200 (GET, application/json) para "${caminhoEndpoint}" no documento`,
      );
    }

    // Resposta de lista (array de $ref) - pega o schema do ITEM, e' ele que
    // vira o model (mesmo padrao de todo endpoint de sync ja existente,
    // que sempre retorna array).
    const alvo = schemaBruto.type === 'array' ? (schemaBruto.items ?? {}) : schemaBruto;
    return this.resolverRef(documento, alvo);
  }

  private resolverRef(documento: OpenApiDocument, schema: OpenApiSchema): OpenApiSchema {
    if (!schema.$ref) {
      return schema;
    }
    const nomeSchema = schema.$ref.replace('#/components/schemas/', '');
    const resolvido = documento.components?.schemas?.[nomeSchema];
    if (!resolvido) {
      throw new BadRequestException(`$ref "${schema.$ref}" nao encontrado em components.schemas`);
    }
    return resolvido;
  }

  private inferirCampo(nomeCampo: string, propSchema: OpenApiSchema): CampoInferido {
    const nomeColunaSnakeCase = paraSnakeCase(nomeCampo);

    if (propSchema.type === 'string' && (propSchema.format === 'date' || propSchema.format === 'date-time')) {
      return {
        nomeCampo,
        nomeColunaSnakeCase,
        suportado: true,
        tipoPrisma: `DateTime? @map("${nomeColunaSnakeCase}")`,
        tipoTypeScript: 'Date | null',
        linhaMap: `${nomeCampo}: bruto.${nomeCampo} ? new Date(bruto.${nomeCampo}) : null,`,
      };
    }
    if (propSchema.type === 'string') {
      return {
        nomeCampo,
        nomeColunaSnakeCase,
        suportado: true,
        tipoPrisma: `String? @map("${nomeColunaSnakeCase}")`,
        tipoTypeScript: 'string | null',
        linhaMap: `${nomeCampo}: bruto.${nomeCampo} ?? null,`,
      };
    }
    if (propSchema.type === 'integer') {
      return {
        nomeCampo,
        nomeColunaSnakeCase,
        suportado: true,
        tipoPrisma: `Int? @map("${nomeColunaSnakeCase}")`,
        tipoTypeScript: 'number | null',
        linhaMap: `${nomeCampo}: bruto.${nomeCampo} ?? null,`,
      };
    }
    if (propSchema.type === 'number') {
      return {
        nomeCampo,
        nomeColunaSnakeCase,
        suportado: true,
        // TODO no proprio rascunho (nao aqui) - Float perde precisao pra
        // valor monetario, revisar se deve virar Decimal (ver
        // schema.prisma, campos ...@db.Decimal usados em valores de venda).
        tipoPrisma: `Float? @map("${nomeColunaSnakeCase}") // TODO: revisar - considerar Decimal se for valor monetario`,
        tipoTypeScript: 'number | null',
        linhaMap: `${nomeCampo}: bruto.${nomeCampo} ?? null,`,
      };
    }
    if (propSchema.type === 'boolean') {
      return {
        nomeCampo,
        nomeColunaSnakeCase,
        suportado: true,
        tipoPrisma: `Boolean @default(false) @map("${nomeColunaSnakeCase}")`,
        tipoTypeScript: 'boolean',
        linhaMap: `${nomeCampo}: bruto.${nomeCampo} ?? false,`,
      };
    }

    // object/array/desconhecido - fora de escopo mapear automaticamente
    // (ver header da classe). Fica so como aviso, revisao humana decide.
    return {
      nomeCampo,
      nomeColunaSnakeCase,
      suportado: false,
      tipoPrisma: `// TODO: revisar - campo "${nomeCampo}" (tipo "${propSchema.type ?? 'desconhecido'}") nao mapeado automaticamente (objeto/array/relacionamento)`,
      tipoTypeScript: 'unknown',
      linhaMap: `// TODO: revisar - "${nomeCampo}" nao mapeado automaticamente`,
    };
  }

  private gerarModeloPrisma(nomeEntidade: string, campos: CampoInferido[]): string {
    const nomeModelo = paraPascalCase(nomeEntidade);
    const linhasCampo = campos
      .filter((campo) => campo.nomeCampo !== 'id')
      .map((campo) =>
        campo.suportado
          ? `  ${campo.nomeCampo.padEnd(20)} ${campo.tipoPrisma}`
          : `  ${campo.tipoPrisma}`,
      )
      .join('\n');

    return [
      `// RASCUNHO gerado por POST /admin/endpoints/importar-swagger - REVISAR antes de`,
      `// colar em schema.prisma e rodar prisma migrate dev. NUNCA aplicar direto em`,
      `// producao sem revisao humana (ver OS-BACKEND-30).`,
      `model ${nomeModelo} {`,
      `  id               String   @id @default(uuid())`,
      `  idExternoErp     String   @unique @map("id_externo_erp") // TODO: revisar - confirmar que "id" da resposta e' realmente a chave de dedup`,
      linhasCampo,
      `  incompleto       Boolean  @default(false)`,
      `  sincronizadoEm   DateTime @map("sincronizado_em")`,
      ``,
      `  @@map("${paraSnakeCasePlural(nomeEntidade)}")`,
      `}`,
    ].join('\n');
  }

  private gerarSyncStrategy(
    nomeEntidade: string,
    caminhoEndpoint: string,
    campos: CampoInferido[],
  ): string {
    const nomeClasse = `${paraPascalCase(nomeEntidade)}SyncStrategy`;
    const nomeModelo = paraPascalCase(nomeEntidade);
    const camposMapeados = campos.filter((c) => c.nomeCampo !== 'id');
    const linhasMap = camposMapeados.map((c) => `      ${c.linhaMap}`).join('\n');
    const camposFetch = campos.map((c) => `  '${c.nomeCampo}',`).join('\n');

    return [
      `// RASCUNHO gerado por POST /admin/endpoints/importar-swagger - REVISAR antes de`,
      `// usar. NAO registrado em nenhum module ainda (ver OS-BACKEND-30, "resultado e'`,
      `// sempre rascunho"). Pontos que exigem decisao humana estao marcados com TODO.`,
      ``,
      `import { Injectable } from '@nestjs/common';`,
      `import { ErpClientService } from '../../erp-client/erp-client.service';`,
      `import { PrismaService } from '../../prisma/prisma.service';`,
      `import type { SyncFetchResultado, SyncStrategy, SyncWindow } from '../sync-strategy.interface';`,
      ``,
      `const ROTA_${nomeEntidade.toUpperCase().replace(/-/g, '_')} = '${caminhoEndpoint}';`,
      ``,
      `const CAMPOS = [`,
      camposFetch,
      `];`,
      ``,
      `@Injectable()`,
      `export class ${nomeClasse} implements SyncStrategy<unknown, unknown> {`,
      `  readonly nomeEntidade = '${nomeEntidade}';`,
      `  // TODO: revisar - agendamento adequado (INCREMENTAL/INCREMENTAL_NOTURNO/`,
      `  // JANELA_FIXA_DIARIA/CONFIGURAVEL, ver sync-strategy.interface.ts) depende do`,
      `  // volume e frequencia de alteracao real desta entidade, nao inferivel do Swagger.`,
      ``,
      `  constructor(`,
      `    private readonly erpClient: ErpClientService,`,
      `    private readonly prisma: PrismaService,`,
      `  ) {}`,
      ``,
      `  async fetch(janela: SyncWindow): Promise<SyncFetchResultado<unknown>> {`,
      `    // TODO: revisar - qual campo de data usar como cursor incremental e como`,
      `    // a API filtra por ele (range fechado como cliente? so limite inferior`,
      `    // como produto? janela fixa sem cursor como nota-fiscal?) - ver skill`,
      `    // wk-radar-client antes de decidir.`,
      `    const registros = await this.erpClient.get<unknown[]>(ROTA_${nomeEntidade.toUpperCase().replace(/-/g, '_')}, {`,
      `      Fields: CAMPOS,`,
      `    });`,
      `    return { registros, avisos: [] };`,
      `  }`,
      ``,
      `  map(bruto: any): any {`,
      `    return {`,
      `      idExternoErp: bruto.id,`,
      linhasMap,
      `    };`,
      `  }`,
      ``,
      `  async upsert(mapeado: any): Promise<void> {`,
      `    // TODO: revisar - confirmar que idExternoErp e' mesmo a chave de dedup`,
      `    // correta antes de usar este upsert.`,
      `    await this.prisma.${lowerFirst(nomeModelo)}.upsert({`,
      `      where: { idExternoErp: mapeado.idExternoErp },`,
      `      create: { ...mapeado, incompleto: false, sincronizadoEm: new Date() },`,
      `      update: { ...mapeado, incompleto: false, sincronizadoEm: new Date() },`,
      `    });`,
      `  }`,
      `}`,
    ].join('\n');
  }
}

function paraSnakeCase(nome: string): string {
  return nome.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}

function paraPascalCase(nomeKebab: string): string {
  return nomeKebab
    .split('-')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join('');
}

function paraSnakeCasePlural(nomeKebab: string): string {
  return `${nomeKebab.replace(/-/g, '_')}s`;
}

function lowerFirst(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
