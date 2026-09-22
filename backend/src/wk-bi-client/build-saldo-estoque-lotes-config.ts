import { buildWkBiReportConfig } from './build-wk-bi-report-config';

export interface SaldoEstoqueLotesConfigParams {
  empresa: string;
  codigoProduto: string;
}

// Parametros confirmados via chamada real ao WK BI (skill
// wk-radar-bi-client, modelo "Saldo de Produtos por Local de Estocagem -
// BOT") - CodProdutos so aceita UM codigo valido por chamada (lista ou
// codigo invalido nao filtram nada, devolvem o catalogo inteiro, ver
// skill), por isso codigoProduto aqui e' sempre singular e deve ser
// validado contra o cadastro de produto pelo chamador antes de montar
// este config.
//
// SEM campo "Hash" - confirmado via teste real (2026-09-22, base "teste"
// recriada) que ele NAO e' necessario: a chamada funciona normalmente sem
// ele, e um Hash antigo/invalido QUEBRA a chamada com erro 2273 ("Erro ao
// verificar informacoes de autenticacao"), mesmo com login e Empresa
// corretos. Documentacao anterior (skill wk-radar-bi-client) descrevia
// Hash como obrigatorio - corrigido. Se aparecer um cenario real que
// precise dele de volta, adicionar com justificativa nova.
export function buildSaldoEstoqueLotesConfig(
  params: SaldoEstoqueLotesConfigParams,
): string {
  return buildWkBiReportConfig({
    ArquivoExportacao:
      'C:\\WKRadar\\BI\\Registros\\ExpAuto_Gerenciais_Saldo_do_Estoque.txt',
    Separador: ';',
    EliminarCaracteres: '',
    GerarSemAspas: '0',
    ExpCabecalhoColunas: '1',
    SimboloDecimal: ',',
    SimboloAgrupamento: '',
    Modulo: 'ES',
    Empresa: params.empresa,
    Modelo: 'Saldo de Produtos por Local de Estocagem - BOT',
    Relatorio: 'GerencialSaldoEstoque',
    Versao: '1',
    DataFinal: '00/00/0000',
    Filial: '',
    Locais: '',
    TipoEstoque: '0',
    ImprimirSaldosZerados: '0',
    TabPrecos: '',
    ListarApenasNaoMovimentados: '0',
    DataListarApenasNaoMovimentados: '00/00/0000',
    NaoImprimeProdutosInativos: '0',
    DataVencimentoInicial: '00/00/0000',
    DataVencimentoFinal: '00/00/0000',
    // Confirmado via teste real: nao tem efeito na resposta JSON (so no
    // arquivo .txt gravado no servidor WK, nunca lido por nos) - mantido
    // "0" pra nao sugerir uma dependencia que nao existe.
    ImprimirTotalizacao: '0',
    ImprimirLinhaEmBrancoTotalizacao: '0',
    Ordenacao: '0',
    CodProdutos: params.codigoProduto,
    CodItensGradeProduto1: '',
    CodItensGradeProduto2: '',
    CodItensGradeProduto3: '',
    CodGrades: '',
    CodItensGrades: '',
    ListarSubordinados: '0',
  });
}
