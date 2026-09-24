import { ConfigService } from '@nestjs/config';
import { SegredoCryptoService } from './segredo-crypto.service';

const CHAVE_VALIDA = 'a'.repeat(64); // 32 bytes em hex

function configFake(chave: string | undefined = CHAVE_VALIDA) {
  return {
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (key !== 'SEGREDO_CRYPTO_KEY' || chave === undefined) {
        throw new Error(`Config ausente: ${key}`);
      }
      return chave;
    }),
  } as unknown as ConfigService;
}

describe('SegredoCryptoService', () => {
  it('criptografa e descriptografa de volta pro mesmo texto', () => {
    const service = new SegredoCryptoService(configFake());

    const cifrado = service.criptografar('sk-or-super-secreta');

    expect(cifrado).not.toContain('sk-or-super-secreta');
    expect(service.descriptografar(cifrado)).toBe('sk-or-super-secreta');
  });

  it('gera saida diferente a cada chamada (IV aleatorio)', () => {
    const service = new SegredoCryptoService(configFake());

    const cifrado1 = service.criptografar('mesma-chave');
    const cifrado2 = service.criptografar('mesma-chave');

    expect(cifrado1).not.toBe(cifrado2);
  });

  it('descriptografar() rejeita valor em formato invalido', () => {
    const service = new SegredoCryptoService(configFake());

    expect(() => service.descriptografar('nao-e-um-formato-valido')).toThrow(
      /formato invalido/,
    );
  });

  it('rejeita SEGREDO_CRYPTO_KEY com tamanho errado', () => {
    const service = new SegredoCryptoService(configFake('chave-curta-demais'));

    expect(() => service.criptografar('x')).toThrow(/32 bytes/);
  });
});
