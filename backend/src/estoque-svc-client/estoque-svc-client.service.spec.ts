import { of } from 'rxjs';
import { EstoqueSvcClientService } from './estoque-svc-client.service';
import { EstoqueSvcFaultError } from './estoque-svc-fault.error';

function configServiceFake() {
  const valores: Record<string, string> = {
    WK_RADAR_ESTOQUE_SVC_URL: 'http://radar-fake/Estoque.svc/json/BuscarSaldoProduto',
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

// Formato real confirmado empiricamente em 2026-08-21 chamando de dentro
// do container (axios manda Accept:application/json por padrao, o
// servico responde JSON - diferente do XML que curl sem Accept recebe).
const JSON_SUCESSO = {
  BuscarSaldoProdutoResult: {
    QuantidadeDisponivelProdutos: [
      { CodigoGrade1: '', CodigoGrade2: '', CodigoGrade3: '', CodigoProduto: '50010', QuantidadeDisponivel: '14,0830' },
      { CodigoGrade1: '', CodigoGrade2: '', CodigoGrade3: '', CodigoProduto: '50111', QuantidadeDisponivel: '11,3530' },
    ],
  },
};

// Shape de fault em JSON NAO confirmado empiricamente ainda (so a resposta
// de sucesso foi validada contra o servico real) - melhor esforco baseado
// nos campos que a OS documenta pro fault XML (Funcao/IdMensagem/Mensagem),
// aplicados direto como JSON piano. encontrarFault busca recursivamente
// (ver interpretar-resposta-estoque-svc.ts), entao tolera algum wrapper
// extra que a realidade tenha e este teste nao preveja.
const JSON_FAULT = {
  Funcao: 'BuscarSaldoProduto',
  IdMensagem: 7,
  Mensagem: 'Nenhum tipo de estoque selecionado',
};

describe('EstoqueSvcClientService.buscarSaldoProduto', () => {
  it('extrai os itens de uma resposta de sucesso', async () => {
    const httpService = httpServiceFake(JSON_SUCESSO);
    const service = new EstoqueSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    const itens = await service.buscarSaldoProduto();

    expect(itens).toEqual([
      { codigoProduto: '50010', quantidadeDisponivel: '14,0830' },
      { codigoProduto: '50111', quantidadeDisponivel: '11,3530' },
    ]);
  });

  it('envia o corpo JSON com login (nunca hardcoded, vem do ConfigService)', async () => {
    const httpService = httpServiceFake(JSON_SUCESSO);
    const service = new EstoqueSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await service.buscarSaldoProduto();

    const [url, corpo, options] = httpService.post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('http://radar-fake/Estoque.svc/json/BuscarSaldoProduto');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(corpo).toEqual({
      login: { Base: 'empresa-teste', Usuario: 'usuario-teste', Senha: 'senha-teste' },
      filtro: {
        EstoqueProprio: true,
        EstoquePoderTerceiros: false,
        EstoqueTerceiroPoderEmpresa: false,
        ListarProdutosSubordinados: false,
      },
    });
  });

  it('lanca EstoqueSvcFaultError quando o servico retorna um fault', async () => {
    const httpService = httpServiceFake(JSON_FAULT);
    const service = new EstoqueSvcClientService(
      httpService as never,
      configServiceFake() as never,
    );

    await expect(service.buscarSaldoProduto()).rejects.toThrow(EstoqueSvcFaultError);
  });
});
