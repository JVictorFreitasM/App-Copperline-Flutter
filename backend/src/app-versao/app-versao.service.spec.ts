import { NotFoundException } from '@nestjs/common';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppVersaoService } from './app-versao.service';

const SHA = 'a'.repeat(64);

function manifesto(sobrescrever: Record<string, unknown> = {}) {
  return {
    plataforma: 'android',
    versionCode: 7,
    versionName: '1.2.0',
    arquivo: 'copperline-7.apk',
    sha256: SHA,
    tamanhoBytes: 11,
    notas: 'Cadastro de cliente',
    publicadoEm: '2026-10-07T12:00:00.000Z',
    ...sobrescrever,
  };
}

describe('AppVersaoService', () => {
  let raiz: string;
  let pasta: string;

  const montar = () =>
    new AppVersaoService({ get: () => raiz } as never);
  const publicar = (corpo: unknown) =>
    writeFileSync(join(pasta, 'latest.json'), typeof corpo === 'string' ? corpo : JSON.stringify(corpo));

  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), 'app-releases-'));
    pasta = join(raiz, 'android');
    mkdirSync(pasta);
  });
  afterEach(() => rmSync(raiz, { recursive: true, force: true }));

  it('devolve a versão publicada', async () => {
    publicar(manifesto());

    expect(await montar().obterUltima()).toEqual({
      versionCode: 7,
      versionName: '1.2.0',
      arquivo: 'copperline-7.apk',
      sha256: SHA,
      tamanhoBytes: 11,
      notas: 'Cadastro de cliente',
      publicadoEm: '2026-10-07T12:00:00.000Z',
    });
  });

  it('nada publicado (sem manifesto): 404, o app trata como "sem atualização"', async () => {
    await expect(montar().obterUltima()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('manifesto ilegível ou malformado: 404 (nunca derruba o servidor nem o app)', async () => {
    publicar('{ isso nao e json');
    await expect(montar().obterUltima()).rejects.toBeInstanceOf(NotFoundException);

    publicar(manifesto({ versionCode: 'sete' }));
    await expect(montar().obterUltima()).rejects.toBeInstanceOf(NotFoundException);

    publicar(manifesto({ versionCode: 0 }));
    await expect(montar().obterUltima()).rejects.toBeInstanceOf(NotFoundException);

    publicar(manifesto({ sha256: 'curto' }));
    await expect(montar().obterUltima()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('nome de arquivo com caminho (path traversal) é recusado', async () => {
    for (const arquivo of ['../latest.json', '../../etc/passwd.apk', 'a/b.apk', 'sem-extensao', 'x.apk.sh']) {
      publicar(manifesto({ arquivo }));
      await expect(montar().obterUltima()).rejects.toBeInstanceOf(NotFoundException);
    }
  });

  it('abre o APK com tamanho e nome', async () => {
    writeFileSync(join(pasta, 'copperline-7.apk'), 'conteudo-apk');
    publicar(manifesto());

    const apk = await montar().abrirApk();

    expect(apk.nomeArquivo).toBe('copperline-7.apk');
    expect(apk.tamanhoBytes).toBe(12);
    const pedacos: Buffer[] = [];
    for await (const pedaco of apk.stream) pedacos.push(pedaco as Buffer);
    expect(Buffer.concat(pedacos).toString()).toBe('conteudo-apk');
  });

  it('manifesto cita um APK que não existe em disco: 404', async () => {
    publicar(manifesto());

    await expect(montar().abrirApk()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uma publicação nova vale na hora, sem reiniciar (lê o manifesto a cada consulta)', async () => {
    const service = montar();
    publicar(manifesto({ versionCode: 7 }));
    expect((await service.obterUltima()).versionCode).toBe(7);

    publicar(manifesto({ versionCode: 8, arquivo: 'copperline-8.apk' }));

    expect((await service.obterUltima()).versionCode).toBe(8);
  });
});
