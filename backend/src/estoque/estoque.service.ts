import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { buildWkBiReportConfig } from '../wk-bi-client/build-wk-bi-report-config';
import { WkBiClientService } from '../wk-bi-client/wk-bi-client.service';
import {
  paraEstoqueItemDto,
  type EstoqueConsultaDto,
} from './dto/estoque-response.dto';

// Parametros do relatorio "Saldo de Produtos por Local de Estocagem - BOT"
// (Modulo=ES, Relatorio=GerencialSaldoEstoque) confirmados contra o
// workflow n8n ja em producao - fixos, nao ha motivo de negocio pra
// variarem por chamada (so CodProdutos e Hash mudam de fato, e Empresa
// deriva do WK_BI_BASE). Nao usar "True"/"False" - o WK Radar espera "0"/"1"
// nesses campos, e DataFinal/DataVencimento* usam o literal "00/00/0000"
// (nao uma data real) quando o filtro nao se aplica.
const PARAMETROS_FIXOS_SALDO_ESTOQUE = {
  ArquivoExportacao:
    'C:\\WKRadar\\BI\\Registros\\ExpAuto_Gerenciais_Saldo_do_Estoque.txt',
  Separador: ';',
  EliminarCaracteres: '',
  GerarSemAspas: '0',
  ExpCabecalhoColunas: '1',
  SimboloDecimal: ',',
  SimboloAgrupamento: '',
  Modulo: 'ES',
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
  ImprimirTotalizacao: '0',
  ImprimirLinhaEmBrancoTotalizacao: '0',
  Ordenacao: '0',
  CodItensGradeProduto1: '',
  CodItensGradeProduto2: '',
  CodItensGradeProduto3: '',
  CodGrades: '',
  CodItensGrades: '',
  ListarSubordinados: '0',
} as const;

// So leitura sobre dado ja sincronizado (validacao do produto) + consulta
// em tempo real ao WK BI (saldo) - sem regra de negocio nossa, sem entidade
// de dominio (ver skill nest-endpoint, criterio de DDD).
@Injectable()
export class EstoqueService {
  private readonly hashSaldoEstoque: string;
  // Empresa do relatorio = mesmo valor do login.Base do WK BI, em
  // maiusculas - confirmado no workflow de referencia (nao e um dado
  // independente, nao ha motivo pra configurar separado).
  private readonly empresa: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wkBiClient: WkBiClientService,
    configService: ConfigService,
  ) {
    this.hashSaldoEstoque = configService.getOrThrow<string>(
      'WK_BI_HASH_SALDO_ESTOQUE',
    );
    this.empresa = configService.getOrThrow<string>('WK_BI_BASE').toUpperCase();
  }

  async consultarPorIdentificador(
    identificador: string,
  ): Promise<EstoqueConsultaDto> {
    const produto = await this.prisma.produto.findFirst({
      where: {
        OR: [{ idExternoErp: identificador }, { codigo: identificador }],
      },
    });

    if (!produto) {
      throw new NotFoundException(`Produto '${identificador}' não encontrado`);
    }

    if (!produto.codigo) {
      // Caso raro: stub incompleto criado por PedidoSyncStrategy (OS 07)
      // ainda sem codigo real - nao da pra filtrar CodProdutos sem ele.
      throw new NotFoundException(
        `Produto '${identificador}' ainda não possui código sincronizado`,
      );
    }

    const config = buildWkBiReportConfig({
      ...PARAMETROS_FIXOS_SALDO_ESTOQUE,
      Empresa: this.empresa,
      CodProdutos: produto.codigo,
      Hash: this.hashSaldoEstoque,
    });

    const linhas =
      await this.wkBiClient.buscarRelatorioExportacaoAutomatica(config);

    return {
      produtoId: produto.id,
      codigo: produto.codigo,
      itens: linhas.map(paraEstoqueItemDto),
    };
  }
}
