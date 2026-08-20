import { SetMetadata } from '@nestjs/common';

export interface RateLimitConfig {
  // Prefixo de dominio da chave Redis (rate:<prefixo>:<usuario>) - ver
  // convencao de prefixos por dominio no CLAUDE.md.
  prefixo: string;
  limite: number;
  janelaSegundos: number;
}

export const RATE_LIMIT_KEY = 'rate-limit-config';

// Usar junto de @UseGuards(RateLimitGuard) - o guard le esse metadata pra
// saber prefixo/limite/janela da rota.
export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);
