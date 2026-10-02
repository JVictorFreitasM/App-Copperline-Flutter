import { ForbiddenException } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { MobileDadosComerciaisService } from './mobile-dados-comerciais.service';

const IDP_USER: IdpUser = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

function clienteDoBanco(id: string, tabelaPrecoIdExterno: string | null) {
  return {
    id,
    idExternoErp: `ext-${id}`,
    codigo: '10458',
    codigoIntegrador: null,
    cpfCnpj: '123',
    razaoSocial: `Cliente ${id}`,
    nomeFantasia: null,
    email: null,
    contato: null,
    homepage: null,
    inscricaoEstadual: null,
    inativo: false,
    incompleto: false,
    sincronizadoEm: new Date('2026-01-01'),
    localizacaoLat: null,
    localizacaoLng: null,
    enderecos: [],
    tabelaPrecoIdExterno,
    contatos: [],
  };
}

function montar(opcoes: { vendedor?: boolean; escopo?: { tipo: string } } = {}) {
  const prisma = {
    vendedor: {
      findFirst: jest.fn().mockResolvedValue(opcoes.vendedor === false ? null : { id: 'v1' }),
    },
    cliente: {
      findMany: jest
        .fn()
        .mockResolvedValue([clienteDoBanco('c1', 'ext-tab-110'), clienteDoBanco('c2', 'ext-tab-110')]),
    },
    clienteTabelaPreco: {
      // c1 tem associacao manual (vence a nativa); c2 nao tem nenhuma
      findMany: jest.fn().mockResolvedValue([
        { clienteId: 'c1', codigo: '111' },
        { clienteId: 'c1', codigo: '112' },
      ]),
    },
    tabelaPreco: {
      findMany: jest.fn().mockResolvedValue([
        { id: 't110', codigo: '110', idExternoErp: 'ext-tab-110' },
        { id: 't111', codigo: '111', idExternoErp: 'ext-tab-111' },
      ]),
    },
    itemTabelaPreco: {
      findMany: jest.fn().mockResolvedValue([
        { tabelaPrecoId: 't110', codigoItem: '50039', preco: { toString: () => '2879.13' } },
        { tabelaPrecoId: 't111', codigoItem: '50039', preco: { toString: () => '2500' } },
      ]),
    },
  };
  const escopoService = {
    resolverEscopoClientes: jest.fn().mockResolvedValue(opcoes.escopo ?? { tipo: 'TODOS' }),
  };
  return {
    prisma,
    service: new MobileDadosComerciaisService(
      prisma as never,
      escopoService as never,
      { obter: jest.fn().mockResolvedValue({ permitirItensRepetidos: false }) } as never,
    ),
  };
}

describe('MobileDadosComerciaisService', () => {
  it('lanca Forbidden quando o usuario nao e um vendedor cadastrado', async () => {
    const { service } = montar({ vendedor: false });
    await expect(service.obter(IDP_USER, 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('associacao manual do cliente vence; sem associacao cai pra tabela nativa do Radar', async () => {
    const { service } = montar();

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.tabelasPorCliente).toEqual({ c1: ['111', '112'], c2: ['110'] });
  });

  it('inclui os precos por tabela em formato compacto [codigoItem, preco]', async () => {
    const { service } = montar();

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.tabelasPreco).toEqual([
      { codigo: '110', itens: [['50039', '2879.13']] },
      { codigo: '111', itens: [['50039', '2500']] },
    ]);
  });

  it('devolve a carteira com detalhe (codigo, enderecos, contatos)', async () => {
    const { service } = montar();

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.clientes).toHaveLength(2);
    expect(resultado.clientes[0]).toEqual(
      expect.objectContaining({ id: 'c1', codigo: '10458', enderecos: [], contatos: [] }),
    );
  });

  it('entrega a regra de itens repetidos pro app validar antes de enviar', async () => {
    const { service } = montar();

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.permitirItensRepetidos).toBe(false);
  });

  it('escopo NENHUM: carteira vazia, sem consultar clientes', async () => {
    const { service, prisma } = montar({ escopo: { tipo: 'NENHUM' } });

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.clientes).toEqual([]);
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });
});
