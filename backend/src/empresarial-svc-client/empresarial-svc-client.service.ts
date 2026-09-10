import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { buildBuscarTabelasPrecoBody } from './build-buscar-tabelas-preco-body';
import { EmpresarialSvcFaultError } from './empresarial-svc-fault.error';
import type { TabelaPrecoBruta } from './empresarial-svc-client.types';
import { encontrarFault, encontrarTabelasPreco } from './interpretar-resposta-empresarial-svc';

// Servico WCF legado (Empresarial.svc) - POST em
// .../Empresarial.svc/json/BuscarTabelasPreco. Mesma familia de
// Estoque.svc/Financeiro.svc: o request e' JSON puro, e a RESPOSTA tambem
// vem em JSON quando o cliente manda Accept compativel (axios manda por
// padrao) - confirmado empiricamente (curl sem Accept explicito recebe
// XML "cru", mas isso nao afeta este client, que usa axios). Reaproveita
// as credenciais WK_BI_* (mesmo servidor Radar, mesma conta, ja
// confirmado em WK_RADAR_ESTOQUE_SVC_URL/WK_RADAR_FINANCEIRO_SVC_URL) -
// sem env var de credencial nova.
@Injectable()
export class EmpresarialSvcClientService {
  private readonly logger = new Logger(EmpresarialSvcClientService.name);
  private readonly url: string;
  private readonly requestTimeoutMs: number;
  private readonly login: { base: string; usuario: string; senha: string };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.url = this.configService.getOrThrow<string>('WK_RADAR_EMPRESARIAL_SVC_URL');
    this.login = {
      base: this.configService.getOrThrow<string>('WK_BI_BASE'),
      usuario: this.configService.getOrThrow<string>('WK_BI_USUARIO'),
      senha: this.configService.getOrThrow<string>('WK_BI_SENHA'),
    };
    // NAO reaproveita WK_BI_REQUEST_TIMEOUT_MS (60s, calibrado pro
    // Estoque.svc) - confirmado empiricamente em 2026-09-08 que
    // BuscarTabelasPreco com filtro:{} (full refresh, todas as tabelas
    // numa chamada so, ~7,9MB de resposta) leva ~90s do HOST mas ~188s de
    // DENTRO do container backend (rede do Docker ~2x mais lenta nesse
    // ambiente, medido com node fetch direto no container) - 60s e ate
    // 180s ja estouraram timeout em tentativas reais de sync. 5min da
    // margem de verdade.
    this.requestTimeoutMs = Number(
      this.configService.get('WK_RADAR_EMPRESARIAL_SVC_TIMEOUT_MS') ?? 300_000,
    );
  }

  // Sem `codigo` (padrao) - traz TODAS as tabelas de preco ativas numa
  // chamada so (confirmado empiricamente: filtro:{} nao filtra por
  // Codigo). Usado assim pelo sync (full refresh) de proposito.
  async buscarTabelasPreco(codigo?: string): Promise<TabelaPrecoBruta[]> {
    const corpo = buildBuscarTabelasPrecoBody(this.login, codigo);

    const resposta = await firstValueFrom(
      this.httpService.post<unknown>(this.url, corpo, {
        headers: { 'Content-Type': 'application/json' },
        timeout: this.requestTimeoutMs,
        // Fault classico responderia HTTP 500 com o detalhe no corpo -
        // aceitar qualquer status aqui e interpretar o corpo na mao (mesmo
        // criterio de EstoqueSvcClientService/FinanceiroSvcClientService).
        validateStatus: () => true,
      }),
    );

    return this.interpretarResposta(resposta.data);
  }

  private interpretarResposta(documento: unknown): TabelaPrecoBruta[] {
    const fault = encontrarFault(documento);
    if (fault) {
      this.logger.error(
        `Empresarial.svc (BuscarTabelasPreco) retornou fault: funcao=${fault.funcao} idMensagem=${fault.idMensagem} mensagem=${fault.mensagem}`,
      );
      throw new EmpresarialSvcFaultError(fault.funcao, fault.idMensagem, fault.mensagem);
    }

    return encontrarTabelasPreco(documento);
  }
}
