import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV_BYTES = 12;
const TAMANHO_CHAVE_BYTES = 32;

// Criptografia simetrica para segredos guardados em runtime no Postgres
// (ex: ConfiguracaoLlm.apiKey) - unico caso no projeto que foge da
// convencao "credencial de servico externo = env var" (ver comentario em
// schema.prisma, model ConfiguracaoLlm), entao a chave que cifra/decifra
// continua em env var (SEGREDO_CRYPTO_KEY, 32 bytes em hex), nunca no
// banco. Saida no formato "<iv-hex>:<tag-hex>:<cifrado-hex>".
@Injectable()
export class SegredoCryptoService {
  constructor(private readonly configService: ConfigService) {}

  criptografar(textoPlano: string): string {
    const chave = this.obterChave();
    const iv = randomBytes(TAMANHO_IV_BYTES);
    const cipher = createCipheriv(ALGORITMO, chave, iv);
    const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${cifrado.toString('hex')}`;
  }

  descriptografar(valorCifrado: string): string {
    const chave = this.obterChave();
    const [ivHex, tagHex, cifradoHex] = valorCifrado.split(':');
    if (!ivHex || !tagHex || !cifradoHex) {
      throw new Error('Valor cifrado em formato invalido (esperado "iv:tag:cifrado" em hex)');
    }

    const decipher = createDecipheriv(ALGORITMO, chave, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const textoPlano = Buffer.concat([
      decipher.update(Buffer.from(cifradoHex, 'hex')),
      decipher.final(),
    ]);
    return textoPlano.toString('utf8');
  }

  private obterChave(): Buffer {
    const chaveHex = this.configService.getOrThrow<string>('SEGREDO_CRYPTO_KEY');
    const chave = Buffer.from(chaveHex, 'hex');
    if (chave.length !== TAMANHO_CHAVE_BYTES) {
      throw new Error('SEGREDO_CRYPTO_KEY deve ter 32 bytes (64 caracteres hex)');
    }
    return chave;
  }
}
