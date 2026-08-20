import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { WkBiClientService } from './wk-bi-client.service';

function ok<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as never,
  };
}

const ENV: Record<string, string> = {
  WK_BI_URL: 'http://wk-bi-teste.local/json',
  WK_BI_BASE: 'base-teste',
  WK_BI_USUARIO: 'usuario-teste',
  WK_BI_SENHA: 'senha-teste',
};

function configServiceFake() {
  return {
    getOrThrow: jest.fn((chave: string) => ENV[chave]),
    get: jest.fn((chave: string) => ENV[chave]),
  } as unknown as ConfigService;
}

describe('WkBiClientService.buscarRelatorioExportacaoAutomatica', () => {
  it('retorna as linhas quando a resposta e um array', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(of(ok([{ Produto: 'X' }]))),
    } as unknown as HttpService;
    const service = new WkBiClientService(httpService, configServiceFake());

    const resultado = await service.buscarRelatorioExportacaoAutomatica('cfg');

    expect(resultado).toEqual([{ Produto: 'X' }]);
  });

  it('trata "sem dados" como lista vazia, nao como erro', async () => {
    const httpService = {
      post: jest.fn().mockReturnValue(
        of(
          ok({
            error: { message: 'Não existem dados para o relatório solicitado' },
          }),
        ),
      ),
    } as unknown as HttpService;
    const service = new WkBiClientService(httpService, configServiceFake());

    const resultado = await service.buscarRelatorioExportacaoAutomatica('cfg');

    expect(resultado).toEqual([]);
  });

  it('propaga como erro real quando error.message nao e o texto de "sem dados"', async () => {
    const httpService = {
      post: jest
        .fn()
        .mockReturnValue(of(ok({ error: { message: 'Hash inválido' } }))),
    } as unknown as HttpService;
    const service = new WkBiClientService(httpService, configServiceFake());

    await expect(
      service.buscarRelatorioExportacaoAutomatica('cfg'),
    ).rejects.toThrow('Hash inválido');
  });
});
