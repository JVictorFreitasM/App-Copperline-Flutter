import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { CepApiData, CepApiResponse } from './cep-api.types';

const URL_PADRAO = 'https://mileena.opencaramelo.com/cep';
const TIMEOUT_PADRAO_MS = 15_000;

// Unico ponto que fala HTTP com a API de CEP (URL e tratamento de erro do
// provedor ficam aqui). Recebe CEP ja validado/normalizado.
@Injectable()
export class CepApiClientService {
  private readonly logger = new Logger(CepApiClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async consultar(cepNormalizado: string): Promise<CepApiData> {
    const baseUrl = this.configService.get<string>('CEP_API_URL') ?? URL_PADRAO;

    try {
      const response = await firstValueFrom(
        this.httpService.get<CepApiResponse>(`${baseUrl}/${cepNormalizado}`, {
          timeout: TIMEOUT_PADRAO_MS,
        }),
      );

      if (!response.data.success || !response.data.data) {
        throw new NotFoundException('CEP nao encontrado');
      }
      return response.data.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw this.traduzirErro(error);
    }
  }

  private traduzirErro(error: unknown): HttpException {
    const status = error instanceof AxiosError ? error.response?.status : null;
    if (status === HttpStatus.NOT_FOUND) {
      return new NotFoundException('CEP nao encontrado');
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException(
        'Limite de consultas do provedor atingido - tente novamente em instantes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.logger.error(
      `Falha ao consultar API de CEP (status ${status ?? 'sem resposta'}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return new BadGatewayException('Falha ao consultar o provedor de CEP');
  }
}
