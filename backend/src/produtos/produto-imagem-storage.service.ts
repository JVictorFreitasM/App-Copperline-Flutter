import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Disco local do servidor - mesmo padrao ja usado por
// DocumentoStorageService/VisitaFotoStorageService (arquivo institucional
// nao e' critico em volume, object storage seria over-engineering agora).
// Exige volume persistente no docker-compose pra sobreviver a recriacao
// do container.
@Injectable()
export class ProdutoImagemStorageService {
  private readonly diretorioBase: string;

  constructor(configService: ConfigService) {
    this.diretorioBase =
      configService.get<string>('PRODUTOS_IMAGENS_DIR') ?? './uploads/produtos-imagens';
  }

  async salvar(buffer: Buffer, nomeOriginal: string): Promise<string> {
    await mkdir(this.diretorioBase, { recursive: true });
    const nomeArquivo = `${randomUUID()}${extname(nomeOriginal)}`;
    const caminho = join(this.diretorioBase, nomeArquivo);
    await writeFile(caminho, buffer);
    return caminho;
  }

  async ler(caminho: string): Promise<Buffer> {
    return readFile(caminho);
  }

  async remover(caminho: string): Promise<void> {
    try {
      await unlink(caminho);
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw erro;
      }
    }
  }
}
