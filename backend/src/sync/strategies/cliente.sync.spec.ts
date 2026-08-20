import { ClienteSyncStrategy } from './cliente.sync';
import type { WkRadarCliente } from './cliente.types';

describe('ClienteSyncStrategy.map', () => {
  const configServiceFake = { get: () => undefined } as never;
  const strategy = new ClienteSyncStrategy(
    undefined as never,
    undefined as never,
    configServiceFake,
  );

  it('mapeia os campos-chave e usa null para ausentes, sem lancar em campos opcionais', () => {
    const bruto: WkRadarCliente = {
      id: '123',
      codigoIntegrador: null,
      cpfCnpj: '12345678900',
      razaoSocial: 'Cliente Teste Ltda',
      nomeFantasia: null,
      inativo: false,
      enderecos: [{ cep: '01000-000', bairro: 'Centro' }],
      contatos: null,
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado).toEqual({
      idExternoErp: '123',
      codigoIntegrador: null,
      cpfCnpj: '12345678900',
      razaoSocial: 'Cliente Teste Ltda',
      nomeFantasia: null,
      inativo: false,
      enderecos: [{ cep: '01000-000', bairro: 'Centro' }],
      contatos: [],
    });
  });

  it('mapeia contatos aninhados, preservando o id externo de cada um', () => {
    const bruto: WkRadarCliente = {
      id: '123',
      inativo: false,
      contatos: [
        {
          id: 'c1',
          codigoIntegrador: 'INT-1',
          nome: 'Fulano',
          email: 'fulano@example.com',
          funcao: 'Comprador',
          telefoneDDD: '11',
          telefoneNumero: '999999999',
        },
      ],
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.contatos).toEqual([
      {
        idExternoErp: 'c1',
        codigoIntegrador: 'INT-1',
        nome: 'Fulano',
        email: 'fulano@example.com',
        telefoneDdd: '11',
        telefoneNumero: '999999999',
        funcao: 'Comprador',
      },
    ]);
  });
});
