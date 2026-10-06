import {
  montarPayloadWkCliente,
  type DadosCadastroParaWk,
} from './montar-payload-wk-cliente';

const BASE: DadosCadastroParaWk = {
  clienteId: 'cli-1',
  documentoFormatado: '07.127.994/0001-50',
  tipoPessoa: 'Juridica',
  razaoSocial: 'MEGA FIOS LTDA',
  enderecos: [
    {
      tipo: 'Padrao',
      cep: '64076130',
      logradouro: 'AV DEPUTADO PAULO FERRAZ',
      numero: 5250,
      semNumero: false,
      bairro: 'LIVRAMENTO',
      idMunicipio: '52002816',
      telefones: [{ ddd: '86', numero: '32188383' }],
    },
  ],
  contatos: [],
  vendedorIdExterno: null,
};

describe('montarPayloadWkCliente', () => {
  it('monta so o obrigatorio quando nada opcional foi informado', () => {
    expect(montarPayloadWkCliente(BASE)).toEqual({
      codigoIntegrador: 'cli-1',
      cpfCnpj: '07.127.994/0001-50',
      tipoPessoa: 'Juridica',
      razaoSocial: 'MEGA FIOS LTDA',
      enderecos: [
        {
          tipo: 'Padrao',
          cep: '64076130',
          nomeEndereco: 'AV DEPUTADO PAULO FERRAZ',
          semNumero: false,
          numero: 5250,
          bairro: 'LIVRAMENTO',
          idMunicipio: '52002816',
          telefones: [{ ddd: '86', numero: '32188383' }],
        },
      ],
    });
  });

  it('o id local vai como codigoIntegrador (ponte pra reconciliar no sync)', () => {
    expect(montarPayloadWkCliente(BASE).codigoIntegrador).toBe('cli-1');
  });

  it('inclui IE, Suframa, limite de credito, observacoes, vendedor e contatos quando informados', () => {
    const payload = montarPayloadWkCliente({
      ...BASE,
      codigo: '10458',
      nomeFantasia: 'MEGA',
      email: 'a@b.com',
      inscricaoEstadual: '123456',
      suframa: '999',
      limiteCredito: 5000,
      observacoes: 'Situação: ATIVA',
      vendedorIdExterno: 'vend-ext-1',
      contatos: [
        {
          nome: 'Maria',
          funcao: 'Compras',
          email: 'm@b.com',
          telefoneDdd: '86',
          telefoneNumero: '999998888',
          dataNascimento: '1990-05-20',
        },
      ],
    });

    expect(payload).toMatchObject({
      codigo: '10458',
      nomeFantasia: 'MEGA',
      email: 'a@b.com',
      inscricoesLegais: { inscricaoEstadual: '123456', registroSuframa: '999' },
      informacoesFinanceiras: { limiteCredito: 5000 },
      informacoesExtras: { anotacoesGerais: 'Situação: ATIVA' },
      detalhes: { idVendedores: ['vend-ext-1'] },
      contatos: [
        {
          nome: 'Maria',
          funcao: 'Compras',
          email: 'm@b.com',
          telefoneDDD: '86',
          telefoneNumero: '999998888',
          dataNascimento: '1990-05-20',
        },
      ],
    });
  });

  it('limite de credito ZERO e enviado (zero e um valor, nao ausencia)', () => {
    const payload = montarPayloadWkCliente({ ...BASE, limiteCredito: 0 });

    expect(payload.informacoesFinanceiras).toEqual({ limiteCredito: 0 });
  });

  it('endereco sem numero nao manda o campo numero', () => {
    const payload = montarPayloadWkCliente({
      ...BASE,
      enderecos: [{ ...BASE.enderecos[0], semNumero: true, numero: undefined }],
    });

    expect(payload.enderecos[0]).toMatchObject({ semNumero: true });
    expect(payload.enderecos[0]).not.toHaveProperty('numero');
  });

  it('envia endereco de entrega alem do padrao', () => {
    const payload = montarPayloadWkCliente({
      ...BASE,
      enderecos: [BASE.enderecos[0], { ...BASE.enderecos[0], tipo: 'Entrega' }],
    });

    expect(payload.enderecos.map((e) => e.tipo)).toEqual(['Padrao', 'Entrega']);
  });

  it('nao envia blocos vazios (sem IE/Suframa, sem limite, sem obs, sem vendedor, sem contatos)', () => {
    const payload = montarPayloadWkCliente(BASE);

    for (const campo of [
      'inscricoesLegais',
      'informacoesFinanceiras',
      'informacoesExtras',
      'detalhes',
      'contatos',
    ]) {
      expect(payload).not.toHaveProperty(campo);
    }
  });

  it('pessoa fisica leva RG, nascimento e nome da mae em informacoesCadastrais', () => {
    const payload = montarPayloadWkCliente({
      ...BASE,
      tipoPessoa: 'Fisica',
      documentoFormatado: '529.982.247-25',
      rg: '1234567',
      dataNascimento: '1990-05-20',
      nomeMae: 'Maria da Silva',
    });

    expect(payload.informacoesCadastrais).toEqual({
      rg: '1234567',
      dataNascimento: '1990-05-20',
      nomeMae: 'Maria da Silva',
    });
  });

  it('pessoa juridica ignora RG/nascimento/mae mesmo que venham no DTO', () => {
    const payload = montarPayloadWkCliente({ ...BASE, rg: '1', nomeMae: 'X' });

    expect(payload).not.toHaveProperty('informacoesCadastrais');
  });
});
