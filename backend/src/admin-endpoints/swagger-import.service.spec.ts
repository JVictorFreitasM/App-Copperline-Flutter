import { of } from 'rxjs';
import { BadRequestException } from '@nestjs/common';
import { SwaggerImportService } from './swagger-import.service';

function httpServiceFake(documento: unknown) {
  return { get: jest.fn().mockReturnValue(of({ data: documento })) };
}

const DOCUMENTO_EXEMPLO = {
  paths: {
    '/empresarial/v1/cliente-exemplo': {
      get: {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ReadClienteExemploDto' },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ReadClienteExemploDto: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          razaoSocial: { type: 'string' },
          inativo: { type: 'boolean' },
          limiteCredito: { type: 'number', format: 'double' },
          dataCadastro: { type: 'string', format: 'date' },
          enderecos: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
};

describe('SwaggerImportService.importar', () => {
  it('gera rascunho de model e sync strategy a partir de um swagger valido (array de $ref)', async () => {
    const service = new SwaggerImportService(httpServiceFake(DOCUMENTO_EXEMPLO) as never);

    const resultado = await service.importar(
      'https://exemplo.com/swagger.json',
      '/empresarial/v1/cliente-exemplo',
      'cliente-exemplo',
    );

    expect(resultado.avisoRevisaoNecessaria).toBe(true);
    expect(resultado.nomeEntidade).toBe('cliente-exemplo');
    expect(resultado.modeloPrismaRascunho).toContain('model ClienteExemplo {');
    expect(resultado.modeloPrismaRascunho).toContain('razaoSocial          String? @map("razao_social")');
    expect(resultado.modeloPrismaRascunho).toContain(
      'limiteCredito        Float? @map("limite_credito") // TODO: revisar',
    );
    expect(resultado.modeloPrismaRascunho).toContain('dataCadastro         DateTime? @map("data_cadastro")');
    expect(resultado.modeloPrismaRascunho).toContain('idExternoErp');

    expect(resultado.syncStrategyRascunho).toContain('export class ClienteExemploSyncStrategy');
    expect(resultado.syncStrategyRascunho).toContain('idExternoErp: bruto.id,');
    expect(resultado.syncStrategyRascunho).toContain('razaoSocial: bruto.razaoSocial ?? null,');
    expect(resultado.syncStrategyRascunho).toContain(
      'dataCadastro: bruto.dataCadastro ? new Date(bruto.dataCadastro) : null,',
    );

    // Campo array/object nao suportado automaticamente - fica de fora do
    // mapeamento de verdade, so como aviso (Fora de escopo da OS).
    expect(resultado.camposNaoMapeados).toEqual(['enderecos']);
    expect(resultado.modeloPrismaRascunho).toContain('TODO: revisar - campo "enderecos"');
  });

  it('lanca BadRequestException quando o caminho nao existe no documento', async () => {
    const service = new SwaggerImportService(httpServiceFake(DOCUMENTO_EXEMPLO) as never);

    await expect(
      service.importar('https://exemplo.com/swagger.json', '/rota/inexistente', 'x'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanca BadRequestException quando o documento nao tem "paths"', async () => {
    const service = new SwaggerImportService(httpServiceFake({}) as never);

    await expect(
      service.importar('https://exemplo.com/swagger.json', '/empresarial/v1/cliente-exemplo', 'x'),
    ).rejects.toThrow(BadRequestException);
  });
});
