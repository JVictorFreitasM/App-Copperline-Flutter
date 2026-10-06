import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

// ReceitaWS (plano gratis): X-RateLimit-Limit: 3 - e a janela e de 1 MINUTO
// (medido em teste real, 2026-10-06: 3 consultas aceitas e todas as seguintes
// com 429 por quase um minuto). Nao e 3 por segundo.
const LIMITE_PADRAO = 3;
const JANELA_PADRAO_SEGUNDOS = 60;
// Depois de um 429 do provedor, nao tenta de novo por este tempo.
const BLOQUEIO_APOS_429_SEGUNDOS = 60;

// Orcamento de chamadas ao provedor primario de CNPJ, GLOBAL (todos os
// usuarios e instancias somados) e SEM espera: como a janela e de 1 minuto,
// esperar a proxima seria travar a tela - quando o orcamento acaba, a consulta
// segue pro provedor reserva em vez de aguardar.
@Injectable()
export class OrcamentoProvedorService {
  private readonly limite: number;
  private readonly janelaSegundos: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    this.limite = Number(configService.get('RECEITAWS_LIMITE') ?? LIMITE_PADRAO);
    this.janelaSegundos = Number(
      configService.get('RECEITAWS_JANELA_SEGUNDOS') ?? JANELA_PADRAO_SEGUNDOS,
    );
  }

  // true = pode chamar o provedor agora (e a vaga ja foi reservada).
  async tentarReservar(provedor: string): Promise<boolean> {
    if (await this.redis.get(`rate:${provedor}:bloqueado`)) {
      return false;
    }
    const janela = Math.floor(Date.now() / (this.janelaSegundos * 1000));
    const chave = `rate:${provedor}:${janela}`;
    const contagem = await this.redis.incr(chave);
    if (contagem === 1) {
      await this.redis.expire(chave, this.janelaSegundos * 2);
    }
    return contagem <= this.limite;
  }

  // O provedor recusou (429) mesmo com a vaga reservada - nosso orcamento
  // estava otimista (outra aplicacao usando o mesmo token, por exemplo).
  async bloquear(provedor: string): Promise<void> {
    await this.redis.set(`rate:${provedor}:bloqueado`, '1', 'EX', BLOQUEIO_APOS_429_SEGUNDOS);
  }
}
