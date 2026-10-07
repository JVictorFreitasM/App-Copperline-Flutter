import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { ReadStream } from 'node:fs';
import { join, resolve, sep } from 'node:path';

// Subconjunto de latest.json (escrito por mobile/tools/publicar-apk.mjs).
export interface AppVersaoDto {
  versionCode: number;
  versionName: string;
  sha256: string;
  tamanhoBytes: number;
  notas: string;
  publicadoEm: string;
}

export interface ApkParaBaixar {
  stream: ReadStream;
  tamanhoBytes: number;
  nomeArquivo: string;
}

// Nome do arquivo vem do manifesto (que e' escrito por um script nosso, mas e'
// um arquivo em disco): so aceita nome simples de .apk, nunca caminho - fecha
// a porta pra "../" mesmo que o manifesto seja adulterado.
const NOME_APK_VALIDO = /^[A-Za-z0-9._-]+\.apk$/;
const SHA256_VALIDO = /^[0-9a-f]{64}$/;

// Serve a versao mais nova do app Android e o APK, pra o proprio app se
// atualizar (sem Play Store). Sem banco: a "fonte da verdade" e' a pasta de
// releases (latest.json + o .apk), publicada pelo script. Le o manifesto a cada
// consulta (arquivo minusculo) - uma publicacao nova vale na hora, sem reiniciar.
@Injectable()
export class AppVersaoService {
  private readonly logger = new Logger(AppVersaoService.name);
  private readonly pasta: string;

  constructor(configService: ConfigService) {
    this.pasta = resolve(
      configService.get<string>('APP_RELEASES_DIR') ?? '/app-releases',
      'android',
    );
  }

  async obterUltima(): Promise<AppVersaoDto & { arquivo: string }> {
    let bruto: unknown;
    try {
      bruto = JSON.parse(await readFile(join(this.pasta, 'latest.json'), 'utf8'));
    } catch {
      // Nada publicado ainda (ou manifesto ilegivel): o app trata 404 como
      // "sem atualizacao" e segue normalmente.
      throw new NotFoundException('Nenhuma versão publicada');
    }

    const m = bruto as Record<string, unknown>;
    if (
      !Number.isInteger(m.versionCode) ||
      (m.versionCode as number) < 1 ||
      typeof m.versionName !== 'string' ||
      typeof m.arquivo !== 'string' ||
      !NOME_APK_VALIDO.test(m.arquivo) ||
      typeof m.sha256 !== 'string' ||
      !SHA256_VALIDO.test(m.sha256) ||
      !Number.isInteger(m.tamanhoBytes)
    ) {
      this.logger.error('latest.json invalido - atualizacao do app indisponivel');
      throw new NotFoundException('Nenhuma versão publicada');
    }

    return {
      versionCode: m.versionCode as number,
      versionName: m.versionName,
      arquivo: m.arquivo,
      sha256: m.sha256,
      tamanhoBytes: m.tamanhoBytes as number,
      notas: typeof m.notas === 'string' ? m.notas : '',
      publicadoEm: typeof m.publicadoEm === 'string' ? m.publicadoEm : '',
    };
  }

  async abrirApk(): Promise<ApkParaBaixar> {
    const { arquivo } = await this.obterUltima();
    const caminho = resolve(this.pasta, arquivo);
    if (!caminho.startsWith(this.pasta + sep)) {
      throw new NotFoundException('APK não encontrado');
    }
    let tamanho: number;
    try {
      tamanho = (await stat(caminho)).size;
    } catch {
      this.logger.error(`APK ${arquivo} citado em latest.json nao existe em disco`);
      throw new NotFoundException('APK não encontrado');
    }
    return { stream: createReadStream(caminho), tamanhoBytes: tamanho, nomeArquivo: arquivo };
  }
}
