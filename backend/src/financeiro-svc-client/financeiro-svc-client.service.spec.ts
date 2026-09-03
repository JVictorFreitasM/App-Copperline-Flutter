import { of } from 'rxjs';
import { FinanceiroSvcClientService } from './financeiro-svc-client.service';
import { FinanceiroSvcFaultError } from './financeiro-svc-fault.error';

function configServiceFake() {
  const valores: Record<string, string> = {
    WK_RADAR_FINANCEIRO_SVC_URL: 'http://radar-fake/Financeiro.svc/json',
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

const JSON_SUCESSO_POSICAO = {
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
    const httpService = httpServiceFake(JSON_SUCESSO_POSICAO);
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    const posicao = await service.buscarPosicaoFinanceira('CLI-1');

    expect(posicao).toEqual(JSON_SUCESSO_POSICAO.BuscarPosicaoFinanceiraResult);
  });

  it('concatena a URL base com o nome da operacao e envia o corpo JSON com login', async () => {
    const httpService = httpServiceFake(JSON_SUCESSO_POSICAO);
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

describe('FinanceiroSvcClientService.buscarTokenBoleto', () => {
  it('extrai os tokens quando o resultado vem envelopado ({string: [...]}, convencao ArrayOfX)', async () => {
    const httpService = httpServiceFake({
      BuscarTokenBoletoResult: { string: ['tok-abc-123'] },
    });
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    const tokens = await service.buscarTokenBoleto({
      CodigoClienteSacado: 'CLI-1',
      NumeroDocumento: 'DOC-1',
    });

    expect(tokens).toEqual(['tok-abc-123']);
  });

  it('extrai os tokens quando o resultado vem como array puro', async () => {
    const httpService = httpServiceFake({
      BuscarTokenBoletoResult: ['tok-abc-123'],
    });
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    const tokens = await service.buscarTokenBoleto({
      CodigoClienteSacado: 'CLI-1',
      NumeroDocumento: 'DOC-1',
    });

    expect(tokens).toEqual(['tok-abc-123']);
  });

  it('sempre envia CodigoClienteSacado no filtro (nunca so NumeroDocumento - evita IDOR)', async () => {
    const httpService = httpServiceFake({ BuscarTokenBoletoResult: { string: [] } });
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await service.buscarTokenBoleto({
      CodigoClienteSacado: 'CLI-1',
      NumeroDocumento: 'DOC-1',
    });

    const [url, corpo] = httpService.post.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('http://radar-fake/Financeiro.svc/json/BuscarTokenBoleto');
    expect(corpo).toEqual({
      login: { Base: 'empresa-teste', Usuario: 'usuario-teste', Senha: 'senha-teste' },
      filtro: { CodigoClienteSacado: 'CLI-1', NumeroDocumento: 'DOC-1' },
    });
  });

  it('lanca FinanceiroSvcFaultError quando o servico retorna um fault', async () => {
    const httpService = httpServiceFake(JSON_FAULT);
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await expect(
      service.buscarTokenBoleto({ CodigoClienteSacado: 'CLI-1', NumeroDocumento: 'DOC-1' }),
    ).rejects.toThrow(FinanceiroSvcFaultError);
  });
});

describe('FinanceiroSvcClientService.downloadBoleto', () => {
  it('decodifica o base64 da resposta pra Buffer', async () => {
    const pdfFalso = Buffer.from('%PDF-1.4 conteudo falso');
    const httpService = httpServiceFake({
      DownloadBoletoResult: pdfFalso.toString('base64'),
    });
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    const buffer = await service.downloadBoleto('tok-abc-123');

    expect(buffer).toEqual(pdfFalso);
  });

  it('envia so o token no corpo, sem login (DownloadBoleto nao aceita login no WSDL)', async () => {
    const httpService = httpServiceFake({ DownloadBoletoResult: 'AAAA' });
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await service.downloadBoleto('tok-abc-123');

    const [url, corpo] = httpService.post.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('http://radar-fake/Financeiro.svc/json/DownloadBoleto');
    expect(corpo).toEqual({ token: 'tok-abc-123' });
  });

  it('retorna null quando o servico nao devolve DownloadBoletoResult', async () => {
    const httpService = httpServiceFake({});
    const service = new FinanceiroSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    expect(await service.downloadBoleto('tok-invalido')).toBeNull();
  });
});
