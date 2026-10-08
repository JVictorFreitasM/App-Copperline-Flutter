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
import { mapearBrasilApi } from './brasilapi-mapper';
import type { BrasilApiCnpjResponse } from './brasilapi.types';
import type { ConsultaCnpjDto } from './dto/consulta-cnpj-response.dto';

const TIMEOUT_MS = 15_000;

// Segundo provedor (fallback da ReceitaWS, que no plano gratis so aceita 3
// consultas por MINUTO): publico, sem token e sem limite apertado. Devolve o
// MESMO DTO da ReceitaWS e ainda traz o codigo IBGE do municipio.
@Injectable()
export class BrasilApiCnpjClientService {
  private readonly logger = new Logger(BrasilApiCnpjClientService.name);

  constructor(private readonly httpService: HttpService) {}

  async consultar(
    cnpjNormalizado: string,
    provedor: { urlBase: string },
  ): Promise<ConsultaCnpjDto> {
    const baseUrl = provedor.urlBase;
    try {
      const resposta = await firstValueFrom(
        this.httpService.get<BrasilApiCnpjResponse>(`${baseUrl}/${cnpjNormalizado}`, {
          timeout: TIMEOUT_MS,
        }),
      );
      return mapearBrasilApi(resposta.data);
    } catch (error) {
      const status = error instanceof AxiosError ? error.response?.status : null;
      if (status === HttpStatus.NOT_FOUND) {
        throw new NotFoundException('CNPJ nao encontrado');
      }
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        throw new HttpException(
          'Limite de consultas do provedor atingido - tente novamente em instantes',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.logger.error(
        `Falha ao consultar BrasilAPI (status ${status ?? 'sem resposta'}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadGatewayException('Falha ao consultar o provedor de CNPJ');
    }
  }
}
