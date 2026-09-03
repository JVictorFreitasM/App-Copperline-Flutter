import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { buildBuscarPosicaoFinanceiraBody } from './build-buscar-posicao-financeira-body';
import { buildBuscarTokenBoletoBody } from './build-buscar-token-boleto-body';
import { FinanceiroSvcFaultError } from './financeiro-svc-fault.error';
import type {
  FiltroCobrancaContaReceber,
  PosicaoFinanceiraBruta,
} from './financeiro-svc-client.types';
import {
  encontrarBoletoBase64,
  encontrarFault,
  encontrarPosicaoFinanceira,
  encontrarTokensBoleto,
} from './interpretar-resposta-financeiro-svc';

// Servico WCF legado (Financeiro.svc) - mesmo padrao ja usado em
// EstoqueSvcClientService (Estoque.svc): POST com corpo JSON (nao envelope
// SOAP/XML, apesar do WSDL classico), resposta interpretada por busca
// recursiva (nao caminho fixo). WK_RADAR_FINANCEIRO_SVC_URL e' a URL BASE
// do servico (sem operacao no final, diferente de WK_RADAR_ESTOQUE_SVC_URL)
// porque este client chama 3 operacoes diferentes - o nome de cada uma e'
// concatenado em obterUrlOperacao(). Reaproveita as credenciais WK_BI_*
// (mesmo servidor Radar, mesma conta - ja confirmado em
// WK_RADAR_ESTOQUE_SVC_URL) - sem env var de credencial nova.
@Injectable()
export class FinanceiroSvcClientService {
  private readonly logger = new Logger(FinanceiroSvcClientService.name);
  private readonly urlBase: string;
  private readonly requestTimeoutMs: number;
  private readonly login: { base: string; usuario: string; senha: string };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.urlBase = this.configService
      .getOrThrow<string>('WK_RADAR_FINANCEIRO_SVC_URL')
      .replace(/\/+$/, '');
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
    const documento = await this.postJson('BuscarPosicaoFinanceira', corpo);
    return encontrarPosicaoFinanceira(documento);
  }

  // OS-BACKEND-43 - token de acesso ao boleto (curta duracao, uso unico) -
  // sempre exigir CodigoClienteSacado no filtro (nunca so NumeroDocumento,
  // ver comentario em FiltroCobrancaContaReceber - evita IDOR).
  async buscarTokenBoleto(
    filtro: FiltroCobrancaContaReceber,
  ): Promise<string[]> {
    const corpo = buildBuscarTokenBoletoBody(this.login, filtro);
    const documento = await this.postJson('BuscarTokenBoleto', corpo);
    return encontrarTokensBoleto(documento);
  }

  // Unica operacao deste servico sem `login` no corpo (confirmado no WSDL -
  // DownloadBoleto so recebe `token`, que ja carrega a autorizacao).
  async downloadBoleto(token: string): Promise<Buffer | null> {
    const documento = await this.postJson('DownloadBoleto', { token });
    const base64 = encontrarBoletoBase64(documento);
    return base64 ? Buffer.from(base64, 'base64') : null;
  }

  private async postJson(
    operacao: string,
    corpo: Record<string, unknown>,
  ): Promise<unknown> {
    const resposta = await firstValueFrom(
      this.httpService.post<unknown>(`${this.urlBase}/${operacao}`, corpo, {
        headers: { 'Content-Type': 'application/json' },
        timeout: this.requestTimeoutMs,
        // Fault classico responderia HTTP 500 com o detalhe no corpo -
        // aceitar qualquer status e interpretar o corpo na mao (mesmo
        // criterio de EstoqueSvcClientService).
        validateStatus: () => true,
      }),
    );
    return this.interpretarResposta(operacao, resposta.data);
  }

  private interpretarResposta(operacao: string, documento: unknown): unknown {
    const fault = encontrarFault(documento);
    if (fault) {
      this.logger.error(
        `Financeiro.svc (${operacao}) retornou fault: funcao=${fault.funcao} idMensagem=${fault.idMensagem} mensagem=${fault.mensagem}`,
      );
      throw new FinanceiroSvcFaultError(
        fault.funcao,
        fault.idMensagem,
        fault.mensagem,
      );
    }
    return documento;
  }
}
