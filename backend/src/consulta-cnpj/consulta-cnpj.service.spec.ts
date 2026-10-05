import { BadRequestException } from '@nestjs/common';
import { ConsultaCnpjService } from './consulta-cnpj.service';
import type { ReceitaWsClientService } from './receitaws-client.service';
import type { ReceitaWsResponse } from './receitaws.types';

describe('ConsultaCnpjService', () => {
  const consultar = jest.fn<Promise<ReceitaWsResponse>, [string]>();
  const service = new ConsultaCnpjService({
    consultar,
  } as unknown as ReceitaWsClientService);

  beforeEach(() => consultar.mockReset());

  it('nao chama o provedor quando o CNPJ e invalido', async () => {
    await expect(service.consultar('19131243000198')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(consultar).not.toHaveBeenCalled();
  });

  it('normaliza o CNPJ antes de consultar e mapeia a resposta', async () => {
    consultar.mockResolvedValue({
      status: 'OK',
      cnpj: '07.127.994/0001-50',
      nome: 'MEGA FIOS LTDA',
      fantasia: '',
      capital_social: '400000.00',
      atividade_principal: [{ code: '27.33-3-00', text: 'Fabricacao de fios' }],
      atividades_secundarias: [{ code: '00.00-0-00', text: 'Nao informada' }],
      qsa: [{ nome: 'FULANO', qual: '49-Socio-Administrador' }],
      simples: { optante: false },
    });

    const resultado = await service.consultar('07.127.994/0001-50');

    expect(consultar).toHaveBeenCalledWith('07127994000150');
    expect(resultado.razaoSocial).toBe('MEGA FIOS LTDA');
    expect(resultado.nomeFantasia).toBeNull();
    expect(resultado.atividadePrincipal).toEqual({
      codigo: '27.33-3-00',
      descricao: 'Fabricacao de fios',
    });
    expect(resultado.atividadesSecundarias).toEqual([]);
    expect(resultado.socios).toEqual([
      { nome: 'FULANO', qualificacao: '49-Socio-Administrador' },
    ]);
    expect(resultado.optanteSimples).toBe(false);
    expect(resultado.optanteMei).toBeNull();
  });
});
