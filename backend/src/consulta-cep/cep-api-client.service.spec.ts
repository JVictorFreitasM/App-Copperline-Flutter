import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { CepApiClientService } from './cep-api-client.service';

const MILEENA = { id: 'm', formato: 'MILEENA', rotulo: 'Mileena', urlBase: 'https://m.exemplo/cep', token: null };
const VIACEP = { id: 'v', formato: 'VIACEP', rotulo: 'ViaCEP', urlBase: 'https://v.exemplo/ws', token: null };

function montar(cadeia: unknown[]) {
  const httpService = { get: jest.fn() };
  const provedores = { cadeia: jest.fn().mockResolvedValue(cadeia) };
  return { httpService, service: new CepApiClientService(httpService as never, provedores as never) };
}

describe('CepApiClientService - cadeia de provedores', () => {
  it('Mileena responde: nao chama o reserva', async () => {
    const m = montar([MILEENA, VIACEP]);
    m.httpService.get.mockReturnValue(of({ data: { success: true, data: { cep: '64000000', codigoIbge: '1' } } }));

    const dados = await m.service.consultar('64000000');

    expect(dados.cep).toBe('64000000');
    expect(m.httpService.get).toHaveBeenCalledTimes(1);
    expect(m.httpService.get.mock.calls[0][0]).toBe('https://m.exemplo/cep/64000000');
  });

  it('falha no primeiro: usa o ViaCEP e converte para o mesmo formato', async () => {
    const m = montar([MILEENA, VIACEP]);
    m.httpService.get
      .mockReturnValueOnce(throwError(() => new AxiosError('fora', '500', undefined, undefined, { status: 500 } as never)))
      .mockReturnValueOnce(
        of({ data: { logradouro: 'Rua A', bairro: 'Centro', localidade: 'Teresina', uf: 'PI', ibge: '2211001' } }),
      );

    const dados = await m.service.consultar('64000000');

    expect(m.httpService.get.mock.calls[1][0]).toBe('https://v.exemplo/ws/64000000/json/');
    expect(dados).toMatchObject({
      cepFormatado: '64000-000',
      nomeLogradouro: 'Rua A',
      nomeLocalidade: 'Teresina',
      codigoIbge: '2211001',
    });
  });

  it('nao encontrado e definitivo: nao tenta o proximo', async () => {
    const m = montar([MILEENA, VIACEP]);
    m.httpService.get.mockReturnValue(of({ data: { success: false, data: null } }));

    await expect(m.service.consultar('64000000')).rejects.toBeInstanceOf(NotFoundException);
    expect(m.httpService.get).toHaveBeenCalledTimes(1);
  });

  it('ViaCEP com erro:true vira nao encontrado', async () => {
    const m = montar([VIACEP]);
    m.httpService.get.mockReturnValue(of({ data: { erro: true } }));

    await expect(m.service.consultar('64000000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('todos falham: devolve o ultimo erro; cadeia vazia: erro apontando a configuracao', async () => {
    const m = montar([MILEENA]);
    m.httpService.get.mockReturnValue(throwError(() => new Error('rede')));
    await expect(m.service.consultar('64000000')).rejects.toBeInstanceOf(BadGatewayException);

    const vazio = montar([]);
    await expect(vazio.service.consultar('64000000')).rejects.toThrow(/Provedores de API/);
  });
});
