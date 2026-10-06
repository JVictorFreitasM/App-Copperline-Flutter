import { BadRequestException } from '@nestjs/common';
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
  const service = new ConsultaCepService({
    consultar,
  } as unknown as CepApiClientService);

  beforeEach(() => consultar.mockReset());

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
});
