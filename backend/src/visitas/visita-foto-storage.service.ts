import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Disco local do servidor (decisao confirmada com o usuario - extensao
// pos-OS-BACKEND-28). Exige volume persistente no deploy (docker-compose)
// pra sobreviver a recriacao do container - fora do alcance deste service,
// e' config de infraestrutura.
@Injectable()
export class VisitaFotoStorageService {
  private readonly diretorioBase: string;

  constructor(configService: ConfigService) {
    this.diretorioBase =
      configService.get<string>('VISITAS_FOTOS_DIR') ?? './uploads/visitas';
  }

  async salvar(buffer: Buffer): Promise<string> {
    await mkdir(this.diretorioBase, { recursive: true });
    const nomeArquivo = `${randomUUID()}.jpg`;
    const caminho = join(this.diretorioBase, nomeArquivo);
    await writeFile(caminho, buffer);
    return caminho;
  }

  async ler(caminho: string): Promise<Buffer> {
    return readFile(caminho);
  }
}
