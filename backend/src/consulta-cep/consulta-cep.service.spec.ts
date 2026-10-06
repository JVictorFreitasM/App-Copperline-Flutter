import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CepApiClientService } from './cep-api-client.service';
import type { CepApiData } from './cep-api.types';
import { ConsultaCepService } from './consulta-cep.service';

const DADOS: CepApiData = {
  cep: '01311902',
  cepFormatado: '01311-902',
  uf: 'SP',
  nomeLocalidade: 'Sao Paulo',
  nomeBairro: 'Bela Vista',
  tipoLogradouro: '',
  nomeLogradouro: 'Avenida Paulista, 37',
  complementoLogradouro: '',
  unidade: 'Edificio Parque Cultural Paulista',
  codigoIbge: '3550308',
};

describe('ConsultaCepService', () => {
  const consultar = jest.fn<Promise<CepApiData>, [string]>();
  const redisMem = new Map<string, string>();
  const redis = {
    get: jest.fn(async (chave: string) => redisMem.get(chave) ?? null),
    set: jest.fn(async (chave: string, valor: string) => {
      redisMem.set(chave, valor);
      return 'OK';
    }),
  };
  const service = new ConsultaCepService(
    { consultar } as unknown as CepApiClientService,
    redis as never,
  );

  beforeEach(() => {
    consultar.mockReset();
    redisMem.clear();
    redis.get.mockClear();
    redis.set.mockClear();
  });

  it('nao chama o provedor quando o CEP e invalido', async () => {
    await expect(service.consultar('123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(consultar).not.toHaveBeenCalled();
  });

  it('normaliza o CEP antes de consultar e mapeia a resposta', async () => {
    consultar.mockResolvedValue(DADOS);

    const resultado = await service.consultar('01311-902');

    expect(consultar).toHaveBeenCalledWith('01311902');
    expect(resultado.localidade).toBe('Sao Paulo');
    expect(resultado.logradouro).toBe('Avenida Paulista, 37');
    expect(resultado.complemento).toBeNull();
  });

  it('prefixa o tipo do logradouro so quando o nome ainda nao o contem', async () => {
    consultar.mockResolvedValue({
      ...DADOS,
      tipoLogradouro: 'Rua',
      nomeLogradouro: 'das Flores',
    });
    expect((await service.consultar('01311902')).logradouro).toBe(
      'Rua das Flores',
    );

    consultar.mockResolvedValue({
      ...DADOS,
      tipoLogradouro: 'Rua',
      nomeLogradouro: 'Rua das Flores',
    });
    expect((await service.consultar('01311902')).logradouro).toBe(
      'Rua das Flores',
    );
  });

  it('segunda consulta do mesmo CEP sai do cache (provedor chamado uma vez so)', async () => {
    consultar.mockResolvedValue(DADOS);

    const primeira = await service.consultar('01311-902');
    const segunda = await service.consultar('01311902');

    expect(segunda).toEqual(primeira);
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      'cache:cep:01311902',
      expect.any(String),
      'EX',
      30 * 24 * 60 * 60,
    );
  });

  it('CEP inexistente fica em cache negativo e nao volta ao provedor', async () => {
    consultar.mockRejectedValue(new NotFoundException('CEP nao encontrado'));

    await expect(service.consultar('99999999')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.consultar('99999999')).rejects.toBeInstanceOf(NotFoundException);

    expect(consultar).toHaveBeenCalledTimes(1);
  });

  it('falha do provedor (nao 404) NAO vai pro cache negativo', async () => {
    consultar.mockRejectedValueOnce(new Error('provedor fora'));
    consultar.mockResolvedValueOnce(DADOS);

    await expect(service.consultar('01311902')).rejects.toThrow('provedor fora');
    expect((await service.consultar('01311902')).localidade).toBe('Sao Paulo');
  });

  it('consultas SIMULTANEAS do mesmo CEP (cache frio) dividem uma chamada so ao provedor', async () => {
    consultar.mockImplementation(
      () => new Promise((resolver) => setTimeout(() => resolver(DADOS), 20)),
    );

    const resultados = await Promise.all(
      Array.from({ length: 6 }, () => service.consultar('01311902')),
    );

    expect(consultar).toHaveBeenCalledTimes(1);
    expect(resultados.every((r) => r.localidade === 'Sao Paulo')).toBe(true);
  });
});
