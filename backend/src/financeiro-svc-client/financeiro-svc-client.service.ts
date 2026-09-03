import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { buildBuscarPosicaoFinanceiraBody } from './build-buscar-posicao-financeira-body';
import { FinanceiroSvcFaultError } from './financeiro-svc-fault.error';
import type { PosicaoFinanceiraBruta } from './financeiro-svc-client.types';
import {
  encontrarFault,
  encontrarPosicaoFinanceira,
} from './interpretar-resposta-financeiro-svc';

// Servico WCF legado (Financeiro.svc) - mesmo padrao ja usado em
// EstoqueSvcClientService (Estoque.svc): POST em
// .../Financeiro.svc/json/BuscarPosicaoFinanceira com corpo JSON (nao
// envelope SOAP/XML, apesar do WSDL classico), resposta interpretada por
// busca recursiva (nao caminho fixo). Reaproveita as credenciais WK_BI_*
// (mesmo servidor Radar, mesma conta - ja confirmado em
// WK_RADAR_ESTOQUE_SVC_URL) - sem env var de credencial nova.
@Injectable()
export class FinanceiroSvcClientService {
  private readonly logger = new Logger(FinanceiroSvcClientService.name);
  private readonly url: string;
  private readonly requestTimeoutMs: number;
  private readonly login: { base: string; usuario: string; senha: string };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.url = this.configService.getOrThrow<string>(
      'WK_RADAR_FINANCEIRO_SVC_URL',
    );
    this.login = {
      base: this.configService.getOrThrow<string>('WK_BI_BASE'),
      usuario: this.configService.getOrThrow<string>('WK_BI_USUARIO'),
      senha: this.configService.getOrThrow<string>('WK_BI_SENHA'),
    };
    this.requestTimeoutMs = Number(
      this.configService.get('WK_BI_REQUEST_TIMEOUT_MS') ?? 60_000,
    );
  }

  async buscarPosicaoFinanceira(
    codigoCliente: string,
  ): Promise<PosicaoFinanceiraBruta | null> {
    const corpo = buildBuscarPosicaoFinanceiraBody(this.login, codigoCliente);

    const resposta = await firstValueFrom(
      this.httpService.post<unknown>(this.url, corpo, {
        headers: { 'Content-Type': 'application/json' },
        timeout: this.requestTimeoutMs,
        // Fault classico responderia HTTP 500 com o detalhe no corpo -
        // aceitar qualquer status e interpretar o corpo na mao (mesmo
        // criterio de EstoqueSvcClientService).
        validateStatus: () => true,
      }),
    );

    return this.interpretarResposta(resposta.data);
  }

  private interpretarResposta(documento: unknown): PosicaoFinanceiraBruta | null {
    const fault = encontrarFault(documento);
    if (fault) {
      this.logger.error(
        `Financeiro.svc retornou fault: funcao=${fault.funcao} idMensagem=${fault.idMensagem} mensagem=${fault.mensagem}`,
      );
      throw new FinanceiroSvcFaultError(
        fault.funcao,
        fault.idMensagem,
        fault.mensagem,
      );
    }

    return encontrarPosicaoFinanceira(documento);
  }
}
