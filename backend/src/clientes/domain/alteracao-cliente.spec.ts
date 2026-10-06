import type { EnderecoParaWk } from '../endereco-wk';
import {
  aplicarNoPayloadDeCriacao,
  calcularIntencao,
  intencaoVazia,
  montarPatchWk,
  type EstadoEditavel,
} from './alteracao-cliente';

const PADRAO: EnderecoParaWk = {
  tipo: 'Padrao',
  cep: '64076130',
  logradouro: 'AV DEPUTADO PAULO FERRAZ',
  numero: 5250,
  semNumero: false,
  bairro: 'LIVRAMENTO',
  idMunicipio: '52002816',
  telefones: [{ ddd: '86', numero: '32188383' }],
};

const ATUAL: EstadoEditavel = {
  razaoSocial: 'MEGA FIOS LTDA',
  nomeFantasia: null,
  email: 'contato@megafios.com.br',
  inscricaoEstadual: '19.456.789-0',
  limiteCredito: 5000,
  rg: null,
  dataNascimento: null,
  nomeMae: null,
  enderecos: [PADRAO],
};

describe('calcularIntencao', () => {
  it('nada mudou = intencao vazia (nada vai ao ERP)', () => {
    const intencao = calcularIntencao(ATUAL, {
      razaoSocial: 'MEGA FIOS LTDA',
      nomeFantasia: '',
      email: ' contato@megafios.com.br ',
      inscricaoEstadual: '19.456.789-0',
      limiteCredito: 5000,
      enderecos: [{ ...PADRAO, cep: '64076130' }],
    });

    expect(intencaoVazia(intencao)).toBe(true);
  });

  it('guarda SO os campos que mudaram, com o valor desejado', () => {
    const intencao = calcularIntencao(ATUAL, {
      razaoSocial: 'MEGA FIOS LTDA',
      email: 'vendas@megafios.com.br',
      limiteCredito: 8000,
    });

    expect(intencao).toEqual({ email: 'vendas@megafios.com.br', limiteCredito: 8000 });
  });

  it('campo nao informado (undefined) nunca vira alteracao', () => {
    expect(intencaoVazia(calcularIntencao(ATUAL, {}))).toBe(true);
  });

  it('limpar um campo preenchido vira "" na intencao', () => {
    expect(calcularIntencao(ATUAL, { inscricaoEstadual: '' })).toEqual({ inscricaoEstadual: '' });
  });

  it('endereco igual nao entra; endereco alterado entra completo; tipo novo entra', () => {
    const entrega: EnderecoParaWk = { ...PADRAO, tipo: 'Entrega', telefones: [] };
    const intencao = calcularIntencao(ATUAL, {
      enderecos: [PADRAO, { ...entrega, numero: 10 }],
    });

    expect(intencao.enderecos).toEqual([{ ...entrega, numero: 10 }]);
  });

  it('telefone novo no endereco conta como alteracao do endereco', () => {
    const intencao = calcularIntencao(ATUAL, {
      enderecos: [{ ...PADRAO, telefones: [...PADRAO.telefones, { ddd: '86', numero: '999998888' }] }],
    });

    expect(intencao.enderecos?.[0].telefones).toHaveLength(2);
  });
});

describe('aplicarNoPayloadDeCriacao (cadastro ainda nao enviado)', () => {
  const PAYLOAD = {
    codigoIntegrador: 'cli-1',
    cpfCnpj: '07.127.994/0001-50',
    tipoPessoa: 'Juridica',
    razaoSocial: 'MEGA FIOS LTDA',
    nomeFantasia: 'MEGA',
    enderecos: [{ tipo: 'Padrao', cep: '64076130', nomeEndereco: 'AV X', semNumero: true, bairro: 'B', idMunicipio: '1', telefones: [] }],
    inscricoesLegais: { inscricaoEstadual: '123' },
    contatos: [{ nome: 'Maria' }],
  };

  it('troca so o que mudou e preserva o resto (contatos, codigoIntegrador)', () => {
    const novo = aplicarNoPayloadDeCriacao(PAYLOAD, { razaoSocial: 'MEGA FIOS S.A.', limiteCredito: 100 });

    expect(novo).toMatchObject({
      codigoIntegrador: 'cli-1',
      razaoSocial: 'MEGA FIOS S.A.',
      nomeFantasia: 'MEGA',
      informacoesFinanceiras: { limiteCredito: 100 },
      contatos: [{ nome: 'Maria' }],
    });
  });

  it('nao altera o objeto original', () => {
    aplicarNoPayloadDeCriacao(PAYLOAD, { razaoSocial: 'OUTRA' });

    expect(PAYLOAD.razaoSocial).toBe('MEGA FIOS LTDA');
  });

  it('"" remove o campo e o bloco que ficou vazio', () => {
    const novo = aplicarNoPayloadDeCriacao(PAYLOAD, { nomeFantasia: '', inscricaoEstadual: '' });

    expect(novo).not.toHaveProperty('nomeFantasia');
    expect(novo).not.toHaveProperty('inscricoesLegais');
  });

  it('substitui endereco do mesmo tipo e acrescenta tipo novo', () => {
    const novo = aplicarNoPayloadDeCriacao(PAYLOAD, {
      enderecos: [
        { ...PADRAO, logradouro: 'RUA NOVA' },
        { ...PADRAO, tipo: 'Entrega' },
      ],
    });
    const enderecos = novo.enderecos as { tipo: string; nomeEndereco: string }[];

    expect(enderecos.map((e) => e.tipo)).toEqual(['Padrao', 'Entrega']);
    expect(enderecos[0].nomeEndereco).toBe('RUA NOVA');
  });

  it('campos de pessoa fisica so entram em cadastro de pessoa fisica', () => {
    const pj = aplicarNoPayloadDeCriacao(PAYLOAD, { rg: '123' });
    const pf = aplicarNoPayloadDeCriacao({ ...PAYLOAD, tipoPessoa: 'Fisica' }, { rg: '123' });

    expect(pj).not.toHaveProperty('informacoesCadastrais');
    expect(pf.informacoesCadastrais).toEqual({ rg: '123' });
  });
});

describe('montarPatchWk (cliente ja no Radar)', () => {
  const RADAR = {
    enderecos: [
      {
        tipo: 'Padrao',
        cep: '64076-130',
        nomeEndereco: 'AV DEPUTADO PAULO FERRAZ',
        semNumero: false,
        numero: 5250,
        complemento: '',
        bairro: 'LIVRAMENTO',
        idMunicipio: '52002816',
        uf: 'PI',
        codigoIBGE: '2211001',
        idTransportadora: 'T1',
        telefones: [{ ddd: '86', numero: '32188383', extra: 'x' }],
        email: null,
      },
      {
        tipo: 'Faturamento',
        cep: '64000-000',
        nomeEndereco: 'RUA FATURA',
        semNumero: true,
        numero: 0,
        bairro: 'CENTRO',
        idMunicipio: '52002816',
        telefones: [],
      },
    ],
    inscricoesLegais: {
      tipoICMS: 'Contribuinte',
      inscricaoEstadual: '123',
      categoriaFiscal: 'CategoriaNula',
      cnaePrincipal: '2733300',
      registroSuframa: null,
    },
    informacoesFinanceiras: {
      clienteDesde: '2004-12-10T00:00:00',
      limiteCredito: 5000,
      descontoFinanceiro: 2,
      tipoDescontoFinanceiro: 'Percentual',
    },
    informacoesCadastrais: { rg: '1', sexo: 'Feminino', nomeMae: 'Ana' },
  };

  it('campo simples vai sozinho, sem tocar em blocos', () => {
    expect(montarPatchWk(RADAR, { email: 'novo@x.com' })).toEqual({ email: 'novo@x.com' });
  });

  it('IE vai com o bloco inscricoesLegais COMPLETO do Radar (nao apaga tipoICMS/CNAE)', () => {
    expect(montarPatchWk(RADAR, { inscricaoEstadual: '999' })).toEqual({
      inscricoesLegais: {
        tipoICMS: 'Contribuinte',
        inscricaoEstadual: '999',
        categoriaFiscal: 'CategoriaNula',
        cnaePrincipal: '2733300',
        registroSuframa: null,
      },
    });
  });

  it('limite de credito vai com o bloco financeiro completo e data no formato date', () => {
    expect(montarPatchWk(RADAR, { limiteCredito: 8000 })).toEqual({
      informacoesFinanceiras: {
        clienteDesde: '2004-12-10',
        limiteCredito: 8000,
        descontoFinanceiro: 2,
        tipoDescontoFinanceiro: 'Percentual',
      },
    });
  });

  it('pessoa fisica: bloco cadastral completo com so os campos alterados trocados', () => {
    expect(montarPatchWk(RADAR, { rg: '2' })).toEqual({
      informacoesCadastrais: { rg: '2', sexo: 'Feminino', nomeMae: 'Ana' },
    });
  });

  it('endereco alterado: manda a lista COMPLETA, so com chaves do Update, trocando o do mesmo tipo', () => {
    const patch = montarPatchWk(RADAR, {
      enderecos: [{ ...PADRAO, logradouro: 'RUA NOVA', telefones: [] }],
    });
    const enderecos = patch.enderecos as Record<string, unknown>[];

    expect(enderecos).toHaveLength(2);
    expect(enderecos[0]).toMatchObject({ tipo: 'Padrao', nomeEndereco: 'RUA NOVA' });
    expect(enderecos[1]).toEqual({
      tipo: 'Faturamento',
      cep: '64000-000',
      nomeEndereco: 'RUA FATURA',
      semNumero: true,
      numero: 0,
      bairro: 'CENTRO',
      idMunicipio: '52002816',
      telefones: [],
    });
    for (const endereco of enderecos) {
      expect(endereco).not.toHaveProperty('uf');
      expect(endereco).not.toHaveProperty('codigoIBGE');
      expect(endereco).not.toHaveProperty('idTransportadora');
    }
  });

  it('endereco de tipo que o Radar ainda nao tem entra no fim da lista', () => {
    const patch = montarPatchWk(RADAR, { enderecos: [{ ...PADRAO, tipo: 'Entrega' }] });

    expect((patch.enderecos as { tipo: string }[]).map((e) => e.tipo)).toEqual([
      'Padrao',
      'Faturamento',
      'Entrega',
    ]);
  });

  it('telefones do Radar vao so com ddd e numero', () => {
    const patch = montarPatchWk(RADAR, { enderecos: [{ ...PADRAO, tipo: 'Entrega' }] });

    expect((patch.enderecos as { telefones: unknown[] }[])[0].telefones).toEqual([
      { ddd: '86', numero: '32188383' },
    ]);
  });

  it('Radar sem o bloco: monta o bloco so com o campo alterado', () => {
    expect(montarPatchWk({}, { inscricaoEstadual: '1' })).toEqual({
      inscricoesLegais: { inscricaoEstadual: '1' },
    });
  });
});
