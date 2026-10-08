import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import type { Redis } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { aguardarVagaGlobal } from '../common/limitador-global';
import type { ProvedorApiAtivo } from '../provedores-api/provedor-api.types';
import { ProvedoresApiService } from '../provedores-api/provedores-api.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

// Politica de uso do Nominatim (OpenStreetMap): no maximo 1 requisicao por
// segundo, com User-Agent que identifique a aplicacao.
const LIMITE_POR_SEGUNDO = 1;
const ESPERA_MAXIMA_MS = 6_000;
const TIMEOUT_MS = 10_000;
// Endereco nao muda de lugar - 30 dias. Nao encontrado: 1 dia.
const TTL_SEGUNDOS = 30 * 24 * 60 * 60;
const TTL_NAO_ENCONTRADO_SEGUNDOS = 24 * 60 * 60;

interface ResultadoNominatim {
  lat: string;
  lon: string;
  display_name: string;
}

export interface GeocodificacaoDto {
  latitude: number;
  longitude: number;
  nomeExibicao: string;
}

// "Localizar" do popup de endereco (mapa OpenStreetMap): endereco em texto ->
// coordenada. A chamada ao Nominatim passa SEMPRE pelo backend (User-Agent
// fixo, limite global de 1 req/s, cache em Redis) - o navegador nunca fala
// direto com o servico, que bloqueia uso abusivo.
@Injectable()
export class GeocodificacaoService {
  private readonly logger = new Logger(GeocodificacaoService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly provedores: ProvedoresApiService,
  ) {}

  async localizar(consulta: string): Promise<GeocodificacaoDto> {
    const texto = consulta.trim().replace(/\s+/g, ' ');
    const chave = `cache:geocode:${texto.toLowerCase()}`;
    const chaveNegativa = `cache:geocode:nao-encontrado:${texto.toLowerCase()}`;

    const emCache = await this.redis.get(chave);
    if (emCache) {
      return JSON.parse(emCache) as GeocodificacaoDto;
    }
    if (await this.redis.get(chaveNegativa)) {
      throw new NotFoundException('Endereço não localizado no mapa');
    }

    const resultado = await this.consultarProvedores(texto);

    if (!resultado) {
      await this.redis.set(chaveNegativa, '1', 'EX', TTL_NAO_ENCONTRADO_SEGUNDOS);
      throw new NotFoundException('Endereço não localizado no mapa');
    }

    const dto: GeocodificacaoDto = {
      latitude: Number(resultado.lat),
      longitude: Number(resultado.lon),
      nomeExibicao: resultado.display_name,
    };
    await this.redis.set(chave, JSON.stringify(dto), 'EX', TTL_SEGUNDOS);
    return dto;
  }

  // Cadeia de provedores de mapa (Configuracoes > Provedores de API), na ordem:
  // sem resultado ou falha passa pro proximo; so' vira "nao localizado" se nenhum
  // achou, e so' vira erro se nenhum respondeu.
  private async consultarProvedores(texto: string): Promise<ResultadoNominatim | null> {
    const cadeia = await this.provedores.cadeia('GEOCODIFICACAO');
    if (cadeia.length === 0) {
      throw new BadGatewayException(
        'Nenhum provedor de mapas ativo - cadastre em Configurações > Provedores de API',
      );
    }
    let algumRespondeu = false;
    let ultimoErro: unknown = null;
    for (const provedor of cadeia) {
      try {
        await aguardarVagaGlobal(this.redis, 'geocode', LIMITE_POR_SEGUNDO, ESPERA_MAXIMA_MS);
        const resultado = await this.consultarNominatim(provedor, texto);
        algumRespondeu = true;
        if (resultado) return resultado;
      } catch (error) {
        ultimoErro = error;
        this.logger.warn(`Provedor de mapas "${provedor.rotulo}" falhou - tentando o proximo`);
      }
    }
    if (!algumRespondeu && ultimoErro) {
      throw ultimoErro;
    }
    return null;
  }

  private async consultarNominatim(
    provedor: ProvedorApiAtivo,
    texto: string,
  ): Promise<ResultadoNominatim | null> {
    const url = provedor.urlBase;
    const userAgent =
      this.configService.get<string>('GEOCODIFICACAO_USER_AGENT') ?? 'CopperlineApp/1.0';

    try {
      const resposta = await firstValueFrom(
        this.httpService.get<ResultadoNominatim[]>(url, {
          params: { q: texto, format: 'jsonv2', limit: 1, countrycodes: 'br' },
          headers: { 'User-Agent': userAgent, 'Accept-Language': 'pt-BR' },
          timeout: TIMEOUT_MS,
        }),
      );
      return resposta.data[0] ?? null;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const status = error instanceof AxiosError ? error.response?.status : null;
      this.logger.error(
        `Falha ao geocodificar (status ${status ?? 'sem resposta'}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadGatewayException('Falha ao consultar o serviço de mapas');
    }
  }
}
