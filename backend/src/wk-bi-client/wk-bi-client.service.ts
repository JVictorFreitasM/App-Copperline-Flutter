import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { WkBiRelatorioResponse } from './wk-bi-client.types';

// Mensagem literal documentada na skill wk-radar-bi-client - qualquer outro
// conteudo em error e' erro de fato (Hash invalido, relatorio nao
// encontrado etc.) e deve propagar como falha, nunca ser tratado como lista
// vazia.
const MENSAGEM_SEM_DADOS = 'Não existem dados para o relatório solicitado';

// Servico WCF legado (Executivo.svc), separado da API REST do WK Radar -
// autenticacao embutida em cada chamada (sem token), sem rate limit
// documentado. Nao reaproveita ErpClientService (ver skill
// wk-radar-bi-client: protocolo e formato de erro sao diferentes).
@Injectable()
export class WkBiClientService {
  private readonly logger = new Logger(WkBiClientService.name);
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly login: { Base: string; Usuario: string; Senha: string };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService
      .getOrThrow<string>('WK_BI_URL')
      .replace(/\/+$/, '');
    this.login = {
      Base: this.configService.getOrThrow<string>('WK_BI_BASE'),
      Usuario: this.configService.getOrThrow<string>('WK_BI_USUARIO'),
      Senha: this.configService.getOrThrow<string>('WK_BI_SENHA'),
    };
    // 60s (nao 30s) por padrao - confirmado na pratica: uma consulta de um
    // unico produto ja estourou 30s contra o ambiente real (o WK BI tem
    // desempenho inconsistente - o relatorio completo sem filtro nem em 4
    // minutos respondeu, ver skill wk-radar-bi-client).
    this.requestTimeoutMs = Number(
      this.configService.get('WK_BI_REQUEST_TIMEOUT_MS') ?? 60_000,
    );
  }

  async buscarRelatorioExportacaoAutomatica(
    config: string,
  ): Promise<Record<string, unknown>[]> {
    const response = await firstValueFrom(
      this.httpService.post<WkBiRelatorioResponse>(
        `${this.baseUrl}/BuscarRelatorioExportacaoAutomatica`,
        { login: this.login, config },
        { timeout: this.requestTimeoutMs },
      ),
    );

    return this.interpretarResposta(response.data);
  }

  private interpretarResposta(
    data: WkBiRelatorioResponse,
  ): Record<string, unknown>[] {
    if (Array.isArray(data)) {
      return data;
    }

    const mensagemErro = data?.error?.message;
    if (mensagemErro === MENSAGEM_SEM_DADOS) {
      return [];
    }

    this.logger.error(`WK BI retornou erro: ${mensagemErro ?? 'desconhecido'}`);
    throw new Error(`WK BI retornou erro: ${mensagemErro ?? 'desconhecido'}`);
  }
}
