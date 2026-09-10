import { ConfiguracaoTabelaPrecoService } from './configuracao-tabela-preco.service';

function prismaFake(existente: { id: string; codigoSelecionado: string | null } | null) {
  return {
    configuracaoTabelaPreco: {
      findFirst: jest.fn().mockResolvedValue(existente),
      create: jest.fn().mockResolvedValue({
        id: 'nova',
        codigoSelecionado: null,
        atualizadoEm: new Date('2026-09-08T00:00:00.000Z'),
      }),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: existente?.id ?? 'nova',
        codigoSelecionado: data.codigoSelecionado,
        atualizadoEm: new Date('2026-09-08T00:00:00.000Z'),
      })),
    },
  };
}

describe('ConfiguracaoTabelaPrecoService.obter', () => {
  it('cria a linha singleton com codigoSelecionado null quando ainda nao existe', async () => {
    const prisma = prismaFake(null);
    const service = new ConfiguracaoTabelaPrecoService(prisma as never);

    const resultado = await service.obter();

    expect(prisma.configuracaoTabelaPreco.create).toHaveBeenCalled();
    expect(resultado.codigoSelecionado).toBeNull();
  });

  it('retorna a linha existente sem criar de novo', async () => {
    const prisma = prismaFake({
      id: 'c1',
      codigoSelecionado: '110',
      atualizadoEm: new Date('2026-09-08T00:00:00.000Z'),
    } as never);
    const service = new ConfiguracaoTabelaPrecoService(prisma as never);

    const resultado = await service.obter();

    expect(prisma.configuracaoTabelaPreco.create).not.toHaveBeenCalled();
    expect(resultado.codigoSelecionado).toBe('110');
  });
});

describe('ConfiguracaoTabelaPrecoService.selecionar', () => {
  it('atualiza o codigo selecionado', async () => {
    const prisma = prismaFake({ id: 'c1', codigoSelecionado: null });
    const service = new ConfiguracaoTabelaPrecoService(prisma as never);

    const resultado = await service.selecionar('110');

    expect(prisma.configuracaoTabelaPreco.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { codigoSelecionado: '110' },
    });
    expect(resultado.codigoSelecionado).toBe('110');
  });
});

describe('ConfiguracaoTabelaPrecoService.obterCodigoSelecionado', () => {
  it('retorna null quando nenhum codigo foi selecionado ainda', async () => {
    const prisma = prismaFake({ id: 'c1', codigoSelecionado: null });
    const service = new ConfiguracaoTabelaPrecoService(prisma as never);

    expect(await service.obterCodigoSelecionado()).toBeNull();
  });
});
