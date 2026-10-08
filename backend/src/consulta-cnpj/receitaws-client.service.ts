import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { ReceitaWsResponse } from './receitaws.types';

const TIMEOUT_PADRAO_MS = 15_000;

// Unico ponto que fala HTTP com a ReceitaWS (token, URL e tratamento de
// erro do provedor ficam aqui - mesmo raciocinio do erp-client). Recebe
// CNPJ ja validado/normalizado; nao decide nada de negocio.
@Injectable()
export class ReceitaWsClientService {
  private readonly logger = new Logger(ReceitaWsClientService.name);

  constructor(private readonly httpService: HttpService) {}

  // URL e token vem do provedor cadastrado no painel.
  async consultar(
    cnpjNormalizado: string,
    provedor: { urlBase: string; token: string | null },
  ): Promise<ReceitaWsResponse> {
    const token = provedor.token;
    const baseUrl = provedor.urlBase;

    try {
      const response = await firstValueFrom(
        this.httpService.get<ReceitaWsResponse>(
          `${baseUrl}/${cnpjNormalizado}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            timeout: TIMEOUT_PADRAO_MS,
          },
        ),
      );

      if (response.data.status === 'ERROR') {
        throw new NotFoundException(
          response.data.message ?? 'CNPJ nao encontrado',
        );
      }
      return response.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw this.traduzirErro(error);
    }
  }

  private traduzirErro(error: unknown): HttpException {
    const status = error instanceof AxiosError ? error.response?.status : null;
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException(
        'Limite de consultas do provedor atingido - tente novamente em instantes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (status === HttpStatus.NOT_FOUND) {
      return new NotFoundException('CNPJ nao encontrado');
    }
    this.logger.error(
      `Falha ao consultar ReceitaWS (status ${status ?? 'sem resposta'}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return new BadGatewayException('Falha ao consultar o provedor de CNPJ');
  }
}
