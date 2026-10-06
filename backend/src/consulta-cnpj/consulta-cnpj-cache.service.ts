import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import type { ConsultaCnpjDto } from './dto/consulta-cnpj-response.dto';

// Dado cadastral da Receita muda devagar (situacao, socios) - 24 h.
const TTL_CNPJ_SEGUNDOS = 24 * 60 * 60;
// CNPJ que a Receita nao conhece: 10 min - evita repetir uma consulta que ja
// sabemos que vai dar 404, sem travar um CNPJ recem-aberto por muito tempo.
const TTL_NAO_ENCONTRADO_SEGUNDOS = 10 * 60;
// Falha dos provedores: poucos segundos - so pra consultas SIMULTANEAS do mesmo
// CNPJ nao repetirem, cada uma, a chamada que acabou de falhar.
const TTL_FALHA_SEGUNDOS = 15;
// Quem ganha o lock tem este tempo pra consultar o provedor antes do lock
// expirar sozinho (ex: processo morreu no meio).
const TTL_LOCK_MS = 30_000;

export type EntradaCache =
  | { tipo: 'encontrado'; dados: ConsultaCnpjDto }
  | { tipo: 'nao-encontrado' }
  | { tipo: 'falha'; status: number; mensagem: string };

// Redis por tras da consulta de CNPJ (prefixos por dominio, ver CLAUDE.md):
// cache positivo/negativo/de falha e o lock de "single-flight" - duas consultas
// simultaneas do MESMO CNPJ viram uma chamada so ao provedor.
@Injectable()
export class ConsultaCnpjCacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async obter(cnpj: string): Promise<EntradaCache | null> {
    const emCache = await this.redis.get(`cache:cnpj:${cnpj}`);
    if (emCache) {
      return { tipo: 'encontrado', dados: JSON.parse(emCache) as ConsultaCnpjDto };
    }
    if (await this.redis.get(`cache:cnpj:nao-encontrado:${cnpj}`)) {
      return { tipo: 'nao-encontrado' };
    }
    const falha = await this.redis.get(`cache:cnpj:falha:${cnpj}`);
    if (falha) {
      return { tipo: 'falha', ...(JSON.parse(falha) as { status: number; mensagem: string }) };
    }
    return null;
  }

  async guardar(cnpj: string, dados: ConsultaCnpjDto): Promise<void> {
    await this.redis.set(
      `cache:cnpj:${cnpj}`,
      JSON.stringify(dados),
      'EX',
      TTL_CNPJ_SEGUNDOS,
    );
  }

  async guardarNaoEncontrado(cnpj: string): Promise<void> {
    await this.redis.set(
      `cache:cnpj:nao-encontrado:${cnpj}`,
      '1',
      'EX',
      TTL_NAO_ENCONTRADO_SEGUNDOS,
    );
  }

  async guardarFalha(cnpj: string, status: number, mensagem: string): Promise<void> {
    await this.redis.set(
      `cache:cnpj:falha:${cnpj}`,
      JSON.stringify({ status, mensagem }),
      'EX',
      TTL_FALHA_SEGUNDOS,
    );
  }

  // true = este chamador e' o unico que vai ao provedor; false = outro ja esta
  // indo (aguardar o cache).
  async tentarLock(cnpj: string): Promise<boolean> {
    const resultado = await this.redis.set(
      `lock:cnpj:${cnpj}`,
      '1',
      'PX',
      TTL_LOCK_MS,
      'NX',
    );
    return resultado === 'OK';
  }

  async liberarLock(cnpj: string): Promise<void> {
    await this.redis.del(`lock:cnpj:${cnpj}`);
  }
}
