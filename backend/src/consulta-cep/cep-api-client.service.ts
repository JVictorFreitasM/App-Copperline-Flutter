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
import type { ProvedorApiAtivo } from '../provedores-api/provedor-api.types';
import { ProvedoresApiService } from '../provedores-api/provedores-api.service';
import type { CepApiData, CepApiResponse, ViaCepResponse } from './cep-api.types';

const TIMEOUT_PADRAO_MS = 15_000;

// Unico ponto que fala HTTP com as APIs de CEP. Percorre a cadeia de provedores
// cadastrada no painel (Configuracoes > Provedores de API) na ordem: "nao
// encontrado" de qualquer provedor e' definitivo; falha/limite passa pro
// proximo. Recebe CEP ja validado/normalizado.
@Injectable()
export class CepApiClientService {
  private readonly logger = new Logger(CepApiClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly provedores: ProvedoresApiService,
  ) {}

  async consultar(cepNormalizado: string): Promise<CepApiData> {
    const cadeia = await this.provedores.cadeia('CEP');
    if (cadeia.length === 0) {
      throw new BadGatewayException(
        'Nenhum provedor de CEP ativo - cadastre em Configurações > Provedores de API',
      );
    }

    let ultimoErro: HttpException | null = null;
    for (const provedor of cadeia) {
      try {
        return await this.consultarProvedor(provedor, cepNormalizado);
      } catch (error) {
        const traduzido = error instanceof HttpException ? error : this.traduzirErro(provedor, error);
        if (traduzido instanceof NotFoundException) {
          throw traduzido;
        }
        this.logger.warn(`Provedor de CEP "${provedor.rotulo}" falhou: ${traduzido.message} - tentando o proximo`);
        ultimoErro = traduzido;
      }
    }
    throw ultimoErro ?? new BadGatewayException('Falha ao consultar o provedor de CEP');
  }

  private async consultarProvedor(provedor: ProvedorApiAtivo, cep: string): Promise<CepApiData> {
    const headers = provedor.token ? { Authorization: `Bearer ${provedor.token}` } : undefined;
    switch (provedor.formato) {
      case 'VIACEP': {
        const { data } = await firstValueFrom(
          this.httpService.get<ViaCepResponse>(`${provedor.urlBase}/${cep}/json/`, {
            headers,
            timeout: TIMEOUT_PADRAO_MS,
          }),
        );
        if (data.erro) {
          throw new NotFoundException('CEP nao encontrado');
        }
        return mapearViaCep(cep, data);
      }
      default: {
        const { data } = await firstValueFrom(
          this.httpService.get<CepApiResponse>(`${provedor.urlBase}/${cep}`, {
            headers,
            timeout: TIMEOUT_PADRAO_MS,
          }),
        );
        if (!data.success || !data.data) {
          throw new NotFoundException('CEP nao encontrado');
        }
        return data.data;
      }
    }
  }

  private traduzirErro(provedor: ProvedorApiAtivo, error: unknown): HttpException {
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
      `Falha ao consultar API de CEP ${provedor.rotulo} (status ${status ?? 'sem resposta'}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return new BadGatewayException('Falha ao consultar o provedor de CEP');
  }
}

function mapearViaCep(cep: string, dados: ViaCepResponse): CepApiData {
  return {
    cep,
    cepFormatado: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    uf: dados.uf ?? '',
    nomeLocalidade: dados.localidade ?? '',
    nomeBairro: dados.bairro ?? '',
    tipoLogradouro: '',
    nomeLogradouro: dados.logradouro ?? '',
    complementoLogradouro: dados.complemento ?? '',
    unidade: dados.unidade ?? '',
    codigoIbge: dados.ibge ?? '',
  };
}
