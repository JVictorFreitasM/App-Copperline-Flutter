import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

// Protege endpoints administrativos internos (ex: disparo manual de sync)
// que nao sao acessados por um usuario logado via SSO, e sim por uma
// chamada de servico/automacao - por isso usa API key em vez de requireAuth.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-api-key');
    const expectedKey = this.configService.getOrThrow<string>('ADMIN_API_KEY');

    if (!providedKey || !isApiKeyEqual(providedKey, expectedKey)) {
      throw new UnauthorizedException('API key ausente ou invalida');
    }

    return true;
  }
}

// Comparacao em tempo constante - evita vazar o tamanho/prefixo correto da
// chave via diferenca de tempo de resposta (timing attack).
function isApiKeyEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
