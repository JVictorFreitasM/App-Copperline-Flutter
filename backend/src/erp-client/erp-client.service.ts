import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, type Method } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { WkRadarTokenResponse } from './erp-client.types';

interface CachedToken {
  value: string;
  expiresAt: number;
}

// Margem de seguranca subtraida do expiresIn retornado pelo WK Radar, pra
// nao arriscar usar um token que expira nos milissegundos entre a checagem
// de cache e o envio da requisicao.
const TOKEN_EXPIRY_MARGIN_MS = 30_000;

// Radar.API limita a 4 req/s (documentado no proprio swagger.json da API,
// secao "Throttling") - acima disso ela responde 429. Numero maximo de
// tentativas extras apos um 429 antes de desistir.
const MAX_TENTATIVAS_APOS_429 = 3;
const BACKOFF_PADRAO_MS = 1000;

// Modulo isolado (fora de sync/) que autentica no WK Radar e expoe um HTTP
// client generico e autenticado. Nao conhece pedido/cliente/produto/nota
// fiscal - so as strategies de sync (OS 05+) sabem disso; este modulo so
// autentica e faz a requisicao HTTP.
@Injectable()
export class ErpClientService {
  private readonly logger = new Logger(ErpClientService.name);
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly intervaloMinimoMs: number;

  private cachedToken: CachedToken | null = null;
  // Evita "thundering herd": se varias chamadas concorrentes acharem o
  // token expirado ao mesmo tempo, todas aguardam a MESMA autenticacao em
  // andamento em vez de disparar uma requisicao de token cada uma.
  private authenticatingPromise: Promise<string> | null = null;
  // Timestamp (epoch ms) da ultima requisicao disparada - usado pra
  // espacar chamadas sequenciais e respeitar o throttling de 4 req/s (ver
  // MAX_TENTATIVAS_APOS_429 acima). As chamadas deste service ja sao
  // sequenciais por natureza (cada strategy so faz a proxima sub-janela
  // depois de aguardar a anterior), entao um simples "aguardar ate o
  // proximo slot" e suficiente - nao precisa de fila.
  private ultimaRequisicaoEm = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Base fixa {host}/wk.api/api - centralizada aqui (nao em cada
    // strategy) pra corrigir de um so lugar se o padrao de rota do WK Radar
    // mudar de novo (ver skill wk-radar-client, secao "Base de URL"). As
    // strategies passam so o sufixo /{modulo}/v1/{recurso} pro get()/post().
    const host = this.configService
      .getOrThrow<string>('WK_RADAR_API_URL')
      .replace(/\/+$/, '');
    this.baseUrl = `${host}/wk.api/api`;
    // Sem timeout, uma janela de busca ampla demais (paginacao nao
    // confirmada pelo WK Radar - ver skill wk-radar-client) pode travar a
    // requisicao indefinidamente, o que trava junto o worker de sync
    // (concurrency: 1) pra sempre. Confirmado na pratica: uma janela de ~11
    // anos travou sem resposta contra o ambiente de testes.
    this.requestTimeoutMs = Number(
      this.configService.get('WK_RADAR_REQUEST_TIMEOUT_MS') ?? 30_000,
    );
    // ~3.3 req/s por padrao - abaixo do limite de 4 req/s documentado, com
    // margem. Confirmado na pratica: paginar cliente em sub-janelas de 1
    // dia sem esse espacamento disparou 429 contra o ambiente de testes.
    this.intervaloMinimoMs = Number(
      this.configService.get('WK_RADAR_MIN_REQUEST_INTERVAL_MS') ?? 300,
    );
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { params });
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>('POST', path, { data });
  }

  private async request<T>(
    method: Method,
    path: string,
    config: { params?: Record<string, unknown>; data?: unknown },
    isRetryAfterReauth = false,
    tentativasApos429 = 0,
  ): Promise<T> {
    const token = await this.getToken();
    await this.aguardarProximoSlot();

    try {
      const response = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url: `${this.baseUrl}${path}`,
          headers: { Authorization: `Bearer ${token}` },
          params: config.params,
          data: config.data,
          timeout: this.requestTimeoutMs,
        }),
      );
      return response.data;
    } catch (error) {
      if (!isRetryAfterReauth && this.isUnauthorized(error)) {
        this.cachedToken = null;
        return this.request<T>(method, path, config, true, tentativasApos429);
      }

      if (
        this.isRateLimited(error) &&
        tentativasApos429 < MAX_TENTATIVAS_APOS_429
      ) {
        const esperaMs = this.calcularBackoff429(error, tentativasApos429);
        this.logger.warn(
          `429 do WK Radar - aguardando ${esperaMs}ms antes da tentativa ${tentativasApos429 + 1}/${MAX_TENTATIVAS_APOS_429}`,
        );
        await new Promise((resolve) => setTimeout(resolve, esperaMs));
        return this.request<T>(
          method,
          path,
          config,
          isRetryAfterReauth,
          tentativasApos429 + 1,
        );
      }

      throw error;
    }
  }

  private isUnauthorized(error: unknown): boolean {
    return error instanceof AxiosError && error.response?.status === 401;
  }

  private isRateLimited(error: unknown): error is AxiosError {
    return error instanceof AxiosError && error.response?.status === 429;
  }

  private calcularBackoff429(error: AxiosError, tentativa: number): number {
    const retryAfterHeader: unknown = error.response?.headers?.['retry-after'];
    const retryAfterSegundos = Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSegundos) && retryAfterSegundos >= 0) {
      return retryAfterSegundos * 1000;
    }
    return BACKOFF_PADRAO_MS * (tentativa + 1);
  }

  private async aguardarProximoSlot(): Promise<void> {
    const espera =
      this.ultimaRequisicaoEm + this.intervaloMinimoMs - Date.now();
    if (espera > 0) {
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
    this.ultimaRequisicaoEm = Date.now();
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }

    if (!this.authenticatingPromise) {
      this.authenticatingPromise = this.authenticate().finally(() => {
        this.authenticatingPromise = null;
      });
    }

    return this.authenticatingPromise;
  }

  private async authenticate(): Promise<string> {
    await this.aguardarProximoSlot();

    const response = await firstValueFrom(
      this.httpService.post<WkRadarTokenResponse>(
        `${this.baseUrl}/v1/token`,
        {
          empresa: this.configService.getOrThrow<string>('WK_RADAR_EMPRESA'),
          nomeUsuario:
            this.configService.getOrThrow<string>('WK_RADAR_USUARIO'),
          senha: this.configService.getOrThrow<string>('WK_RADAR_SENHA'),
          idIntegrador:
            this.configService.get<string>('WK_RADAR_ID_INTEGRADOR') ?? null,
        },
        { timeout: this.requestTimeoutMs },
      ),
    );

    const expiresInMs = response.data.expiresIn * 1000;
    this.cachedToken = {
      value: response.data.token,
      expiresAt: Date.now() + expiresInMs - TOKEN_EXPIRY_MARGIN_MS,
    };
    this.logger.log(
      `Autenticado no WK Radar (token valido por ${response.data.expiresIn}s)`,
    );
    return this.cachedToken.value;
  }
}
