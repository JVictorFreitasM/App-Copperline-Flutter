import { of } from 'rxjs';
import { FinanceiroSvcClientService } from './financeiro-svc-client.service';
import { FinanceiroSvcFaultError } from './financeiro-svc-fault.error';

function configServiceFake() {
  const valores: Record<string, string> = {
    WK_RADAR_FINANCEIRO_SVC_URL: 'http://radar-fake/Financeiro.svc/json/BuscarPosicaoFinanceira',
    WK_BI_BASE: 'empresa-teste',
    WK_BI_USUARIO: 'usuario-teste',
    WK_BI_SENHA: 'senha-teste',
  };
  return {
    getOrThrow: jest.fn((chave: string) => {
      const valor = valores[chave];
      if (valor === undefined) throw new Error(`Config ausente: ${chave}`);
      return valor;
    }),
    get: jest.fn((chave: string) => valores[chave]),
  };
}

function httpServiceFake(resposta: unknown) {
  return {
    post: jest.fn().mockReturnValue(of({ data: resposta })),
  };
}

// Shape de sucesso baseado no WSDL (elemento PosicaoFinanceira,
// BuscarPosicaoFinanceiraResult) - mesmo criterio de tolerancia a wrapper
// extra ja documentado em estoque-svc-client.service.spec.ts (busca
// recursiva, nao caminho fixo).
const JSON_SUCESSO = {
  BuscarPosicaoFinanceiraResult: {
    ValorLimite: 50000,
    ValorLimiteSerasa: 0,
    ValorCreditoDisponivel: 32000,
    ValorCreditoUtilizado: 18000,
    ValorSaldoAVencer: 15000,
    ValorSaldoVencido: 3000,
    ValorMaiorAtraso: 3000,
    MediaAtraso: 5,
    QtdeBaixasPorInadimplencia: 0,
    ValorTotalDeCompras: 250000,
    DataUltimaFatura: '2026-08-15',
    VendaBloqueada: false,
  },
};

const JSON_FAULT = {
  Funcao: 'BuscarPosicaoFinanceira',
  IdMensagem: 3,
  Mensagem: 'Cliente nao encontrado',
};

describe('FinanceiroSvcClientService.buscarPosicaoFinanceira', () => {
  it('extrai a posicao financeira de uma resposta de sucesso', async () => {
    const httpService = httpServiceFake(JSON_SUCESSO);
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    const posicao = await service.buscarPosicaoFinanceira('CLI-1');

    expect(posicao).toEqual(JSON_SUCESSO.BuscarPosicaoFinanceiraResult);
  });

  it('envia o corpo JSON com login (nunca hardcoded, vem do ConfigService) e o codigo do cliente no filtro', async () => {
    const httpService = httpServiceFake(JSON_SUCESSO);
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await service.buscarPosicaoFinanceira('CLI-1');

    const [url, corpo, options] = httpService.post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('http://radar-fake/Financeiro.svc/json/BuscarPosicaoFinanceira');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(corpo).toEqual({
      login: { Base: 'empresa-teste', Usuario: 'usuario-teste', Senha: 'senha-teste' },
      filtro: {
        Codigo: 'CLI-1',
        ConsiderarTitulos: true,
        ConsiderarData: false,
        ConsiderarEmpresas: false,
        ConsiderarFiliais: false,
      },
    });
  });

  it('lanca FinanceiroSvcFaultError quando o servico retorna um fault', async () => {
    const httpService = httpServiceFake(JSON_FAULT);
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await expect(service.buscarPosicaoFinanceira('CLI-1')).rejects.toThrow(
      FinanceiroSvcFaultError,
    );
  });
});
