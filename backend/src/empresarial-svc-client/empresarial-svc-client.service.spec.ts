import { of } from 'rxjs';
import { EmpresarialSvcClientService } from './empresarial-svc-client.service';
import { EmpresarialSvcFaultError } from './empresarial-svc-fault.error';

function configServiceFake() {
  const valores: Record<string, string> = {
    WK_RADAR_EMPRESARIAL_SVC_URL: 'http://radar-fake/Empresarial.svc/json/BuscarTabelasPreco',
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

// Formato real confirmado empiricamente em 2026-09-08 chamando o servico
// real com Accept:application/json (mesmo header default do axios) -
// BuscarTabelasPrecoResult e' um array direto de tabelas, cada uma com
// ItensTabelaPreco como array direto tambem (sem wrapper extra).
const JSON_SUCESSO = {
  BuscarTabelasPrecoResult: [
    {
      Ativa: true,
      Codigo: '110',
      Id: '58',
      ItensTabelaPreco: [
        {
          CodigoItem: '50191',
          DataFimPromocao: '00/00/0000 00:00',
          DataInicioPromocao: '00/00/0000 00:00',
          DataUltimoReajuste: '31/08/2026 00:00',
          PercentualDescontoMaximo: '2,00',
          Preco: '3.225,49',
          PrecoPromocional: '0,00',
          Produto: true,
          QuantidadeMaxima: '99.999.999.999.999,0000',
          QuantidadeMinima: '0,0000',
          ValorDescontoMaximo: '0,00',
        },
      ],
    },
  ],
};

const JSON_FAULT = {
  Funcao: 'GerarLogin',
  IdMensagem: '1968',
  Mensagem: 'Base de dados deve ser informada.',
};

describe('EmpresarialSvcClientService.buscarTabelasPreco', () => {
  it('extrai as tabelas de uma resposta de sucesso', async () => {
    const httpService = httpServiceFake(JSON_SUCESSO);
    const service = new EmpresarialSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    const tabelas = await service.buscarTabelasPreco();

    expect(tabelas).toHaveLength(1);
    expect(tabelas[0].Codigo).toBe('110');
    expect(tabelas[0].ItensTabelaPreco).toHaveLength(1);
    expect(tabelas[0].ItensTabelaPreco[0].CodigoItem).toBe('50191');
  });

  it('envia filtro vazio quando nenhum codigo e passado (full refresh)', async () => {
    const httpService = httpServiceFake(JSON_SUCESSO);
    const service = new EmpresarialSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await service.buscarTabelasPreco();

    const [url, corpo, options] = httpService.post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('http://radar-fake/Empresarial.svc/json/BuscarTabelasPreco');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(corpo).toEqual({
      login: { Base: 'empresa-teste', Usuario: 'usuario-teste', Senha: 'senha-teste' },
      filtro: {},
    });
  });

  it('envia filtro.Codigo quando um codigo especifico e passado', async () => {
    const httpService = httpServiceFake(JSON_SUCESSO);
    const service = new EmpresarialSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await service.buscarTabelasPreco('110');

    const [, corpo] = httpService.post.mock.calls[0] as [string, Record<string, unknown>];
    expect(corpo.filtro).toEqual({ Codigo: '110' });
  });

  it('lanca EmpresarialSvcFaultError quando o servico retorna um fault', async () => {
    const httpService = httpServiceFake(JSON_FAULT);
    const service = new EmpresarialSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await expect(service.buscarTabelasPreco()).rejects.toThrow(EmpresarialSvcFaultError);
  });
});
