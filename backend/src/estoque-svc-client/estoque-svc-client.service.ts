import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { buildBuscarSaldoProdutoBody } from './build-buscar-saldo-produto-body';
import { EstoqueSvcFaultError } from './estoque-svc-fault.error';
import type { SaldoProdutoBruto } from './estoque-svc-client.types';
import {
  encontrarFault,
  encontrarItensSaldo,
} from './interpretar-resposta-estoque-svc';

// Servico WCF legado (Estoque.svc) - POST em
// .../Estoque.svc/json/BuscarSaldoProduto. ATENCAO (confirmado
// empiricamente em 2026-08-21): o formato da RESPOSTA depende do header
// Accept que o cliente manda - curl sem Accept explicito recebe XML sem
// envelope SOAP; axios (Accept default "application/json, text/plain,
// */*") recebe JSON puro. O axios usado aqui recebe JSON, entao nao
// precisa de nenhum parser de XML - so o parse automatico do axios
// (Content-Type: application/json). Nao reaproveita WkBiClientService
// (Executivo.svc) nem ErpClientService (API REST) - servico proprio,
// mesmo criterio ja documentado em WkBiClientService.
@Injectable()
export class EstoqueSvcClientService {
  private readonly logger = new Logger(EstoqueSvcClientService.name);
  private readonly url: string;
  private readonly requestTimeoutMs: number;
  private readonly login: { base: string; usuario: string; senha: string };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.url = this.configService.getOrThrow<string>('WK_RADAR_ESTOQUE_SVC_URL');
    // Mesmas credenciais do WK BI (Executivo.svc) - mesmo servidor Radar,
    // mesma conta (decisao confirmada com o usuario) - nenhuma env var de
    // credencial nova pra este client.
    this.login = {
      base: this.configService.getOrThrow<string>('WK_BI_BASE'),
      usuario: this.configService.getOrThrow<string>('WK_BI_USUARIO'),
      senha: this.configService.getOrThrow<string>('WK_BI_SENHA'),
    };
    this.requestTimeoutMs = Number(
      this.configService.get('WK_BI_REQUEST_TIMEOUT_MS') ?? 60_000,
    );
  }

  async buscarSaldoProduto(): Promise<SaldoProdutoBruto[]> {
    const corpo = buildBuscarSaldoProdutoBody(this.login);

    const resposta = await firstValueFrom(
      this.httpService.post<unknown>(this.url, corpo, {
        headers: { 'Content-Type': 'application/json' },
        timeout: this.requestTimeoutMs,
        // Fault classico responderia HTTP 500 com o detalhe no corpo -
        // aceitar qualquer status aqui e interpretar o corpo na mao (em
        // vez de deixar o axios estourar excecao generica sem corpo).
        validateStatus: () => true,
      }),
    );

    return this.interpretarResposta(resposta.data);
  }

  private interpretarResposta(documento: unknown): SaldoProdutoBruto[] {
    const fault = encontrarFault(documento);
    if (fault) {
      this.logger.error(
        `Estoque.svc retornou fault: funcao=${fault.funcao} idMensagem=${fault.idMensagem} mensagem=${fault.mensagem}`,
      );
      throw new EstoqueSvcFaultError(fault.funcao, fault.idMensagem, fault.mensagem);
    }

    return encontrarItensSaldo(documento).map((item) => ({
      codigoProduto: String(item['CodigoProduto'] ?? ''),
      quantidadeDisponivel: String(item['QuantidadeDisponivel'] ?? '0'),
    }));
  }
}
