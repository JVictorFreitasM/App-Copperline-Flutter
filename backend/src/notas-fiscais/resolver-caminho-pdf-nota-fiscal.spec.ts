import { resolverCaminhoPdfNotaFiscal } from './resolver-caminho-pdf-nota-fiscal';

describe('resolverCaminhoPdfNotaFiscal', () => {
  it('monta o caminho ANO/MES/DIA (data de emissao) + chave-nfe.pdf', () => {
    const caminho = resolverCaminhoPdfNotaFiscal(
      {
        chave: '22260907127994000150550010001772941039670733',
        dataEmissao: new Date('2026-09-05T13:24:51.000Z'),
      },
      '/mnt/notas',
    );

    expect(caminho).toBe(
      '/mnt/notas/2026/09/05/22260907127994000150550010001772941039670733-nfe.pdf',
    );
  });

  it('preenche mes/dia com zero a esquerda quando necessario', () => {
    const caminho = resolverCaminhoPdfNotaFiscal(
      { chave: 'chave-fake', dataEmissao: new Date('2025-01-02T00:00:00.000Z') },
      '/mnt/notas',
    );

    expect(caminho).toBe('/mnt/notas/2025/01/02/chave-fake-nfe.pdf');
  });

  it('retorna null quando falta a chave (ex: nota so tem NFS-e, fora de escopo)', () => {
    expect(
      resolverCaminhoPdfNotaFiscal(
        { chave: null, dataEmissao: new Date() },
        '/mnt/notas',
      ),
    ).toBeNull();
  });

  it('retorna null quando falta dataEmissao', () => {
    expect(
      resolverCaminhoPdfNotaFiscal(
        { chave: 'chave-fake', dataEmissao: null },
        '/mnt/notas',
      ),
    ).toBeNull();
  });
});
