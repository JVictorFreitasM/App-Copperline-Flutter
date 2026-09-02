import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Disco local do servidor - mesma decisao ja tomada pra foto de check-in
// de visita (ver VisitaFotoStorageService), reaproveitada aqui pelo mesmo
// motivo (OS-BACKEND-41: arquivo institucional nao e' critico em volume,
// object storage seria over-engineering agora). Exige volume persistente
// no docker-compose (copperline-documentos) pra sobreviver a recriacao do
// container.
@Injectable()
export class DocumentoStorageService {
  private readonly diretorioBase: string;

  constructor(configService: ConfigService) {
    this.diretorioBase =
      configService.get<string>('DOCUMENTOS_DIR') ?? './uploads/documentos';
  }

  // Preserva a extensao original (diferente da foto de visita, que e'
  // sempre .jpg) - o nome final no disco nunca e' o nome original do
  // upload (evita colisao/traversal), so a extensao pra facilitar
  // diagnostico manual no disco.
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
}
