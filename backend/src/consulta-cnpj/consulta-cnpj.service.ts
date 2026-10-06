import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  tipoPessoaDoDocumento,
  variantesParaBusca,
} from '../clientes/domain/documento';
import { ConsultaCepService } from '../consulta-cep/consulta-cep.service';
import { MunicipioWkService } from '../municipio-wk/municipio-wk.service';
import { PrismaService } from '../prisma/prisma.service';
import { BrasilApiCnpjClientService } from './brasilapi-cnpj-client.service';
import {
  ConsultaCnpjCacheService,
  type EntradaCache,
} from './consulta-cnpj-cache.service';
import { normalizarCnpj } from './domain/cnpj';
import type {
  ClienteJaCadastradoDto,
  ConsultaCnpjDto,
  ConsultaCnpjResultadoDto,
  EnderecoSugeridoDto,
  OrigemConsultaCnpj,
} from './dto/consulta-cnpj-response.dto';
import { OrcamentoProvedorService } from './orcamento-provedor.service';
import { ReceitaWsClientService } from './receitaws-client.service';
import { mapearReceitaWs } from './receitaws-mapper';

// Espera de quem perdeu a disputa do lock pelo resultado de quem ganhou.
const ESPERA_RESULTADO_CONCORRENTE_MS = 10_000;
const INTERVALO_POLLING_MS = 250;
const PROVEDOR_PRIMARIO = 'receitaws';

// Orquestrador da consulta de CNPJ. A ORDEM e' a estrategia de economia de
// requisicoes ao provedor, do mais barato ao mais caro:
//   1. valida por calculo (DV)            - CNPJ invalido nem sai do backend;
//   2. base da empresa (Postgres)         - ja e' cliente: nao consulta a API;
//   3. cache no Redis (positivo/negativo/falha) - mesma consulta em 24 h/10 min;
//   4. single-flight (lock no Redis)      - consultas simultaneas do mesmo CNPJ
//                                           viram uma chamada (e uma falha);
//   5. orcamento do provedor primario     - ReceitaWS aceita 3 consultas por
//                                           MINUTO; acabou, vai pro reserva;
//   6. provedor reserva (BrasilAPI)       - sem limite apertado, ja traz IBGE.
@Injectable()
export class ConsultaCnpjService {
  private readonly logger = new Logger(ConsultaCnpjService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receitaWsClient: ReceitaWsClientService,
    private readonly brasilApiClient: BrasilApiCnpjClientService,
    private readonly cache: ConsultaCnpjCacheService,
    private readonly orcamento: OrcamentoProvedorService,
    private readonly consultaCepService: ConsultaCepService,
    private readonly municipioWkService: MunicipioWkService,
  ) {}

  async consultar(entrada: string): Promise<ConsultaCnpjResultadoDto> {
    if (tipoPessoaDoDocumento(entrada) !== 'Juridica') {
      throw new BadRequestException('CNPJ invalido');
    }
    const cnpj = normalizarCnpj(entrada);

    const jaCadastrado = await this.buscarNaBase(cnpj);
    if (jaCadastrado) {
      return {
        cnpj,
        origem: 'BASE',
        jaCadastrado,
        dados: null,
        enderecoSugerido: null,
      };
    }

    const { dados, origem } = await this.obterDados(cnpj);
    return {
      cnpj,
      origem,
      jaCadastrado: null,
      dados,
      enderecoSugerido: await this.montarEnderecoSugerido(dados),
    };
  }

  private async buscarNaBase(
    cnpj: string,
  ): Promise<ClienteJaCadastradoDto | null> {
    // O sync grava cpf_cnpj FORMATADO - busca nas duas formas.
    const cliente = await this.prisma.cliente.findFirst({
      where: { cpfCnpj: { in: variantesParaBusca(cnpj) } },
      select: {
        razaoSocial: true,
        nomeFantasia: true,
        statusEnvioErp: true,
        vendedores: {
          take: 1,
          orderBy: { criadoEm: 'asc' },
          select: { vendedor: { select: { nome: true } } },
        },
      },
    });
    if (!cliente) {
      return null;
    }
    return {
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      vendedorResponsavel: cliente.vendedores[0]?.vendedor.nome ?? null,
      statusEnvioErp: cliente.statusEnvioErp,
    };
  }

  private async obterDados(
    cnpj: string,
  ): Promise<{ dados: ConsultaCnpjDto; origem: OrigemConsultaCnpj }> {
    const emCache = await this.cache.obter(cnpj);
    if (emCache) {
      return { dados: this.desembrulhar(emCache), origem: 'CACHE' };
    }

    const ganhouLock = await this.cache.tentarLock(cnpj);
    if (!ganhouLock) {
      // Outra requisicao ja esta consultando este CNPJ - espera o resultado
      // dela (dado OU falha) no cache em vez de gastar outra chamada.
      const dePerdedora = await this.aguardarResultadoConcorrente(cnpj);
      if (dePerdedora) {
        return { dados: this.desembrulhar(dePerdedora), origem: 'CACHE' };
      }
      // Quem tinha o lock nao entregou (morreu/expirou) - tenta por conta.
    }

    try {
      const dados = await this.consultarProvedores(cnpj);
      await this.cache.guardar(cnpj, dados);
      return { dados, origem: 'API' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.cache.guardarNaoEncontrado(cnpj);
      } else if (error instanceof HttpException) {
        // Os concorrentes que estao esperando recebem a MESMA falha em vez de
        // repetir a chamada que acabou de falhar.
        await this.cache.guardarFalha(cnpj, error.getStatus(), error.message);
      }
      throw error;
    } finally {
      if (ganhouLock) {
        await this.cache.liberarLock(cnpj);
      }
    }
  }

  // Primario (ReceitaWS) enquanto houver orcamento; senao, ou se ele falhar,
  // o reserva (BrasilAPI). "Nao encontrado" do primario e' definitivo.
  private async consultarProvedores(cnpj: string): Promise<ConsultaCnpjDto> {
    if (await this.orcamento.tentarReservar(PROVEDOR_PRIMARIO)) {
      try {
        return mapearReceitaWs(await this.receitaWsClient.consultar(cnpj));
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        if (
          error instanceof HttpException &&
          error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
        ) {
          await this.orcamento.bloquear(PROVEDOR_PRIMARIO);
        }
        this.logger.warn(
          `ReceitaWS indisponivel para o CNPJ (${error instanceof Error ? error.message : String(error)}) - usando o provedor reserva`,
        );
      }
    }
    return this.brasilApiClient.consultar(cnpj);
  }

  private desembrulhar(entrada: EntradaCache): ConsultaCnpjDto {
    switch (entrada.tipo) {
      case 'nao-encontrado':
        throw new NotFoundException('CNPJ nao encontrado');
      case 'falha':
        throw new HttpException(entrada.mensagem, entrada.status);
      case 'encontrado':
        return entrada.dados;
    }
  }

  private async aguardarResultadoConcorrente(
    cnpj: string,
  ): Promise<EntradaCache | null> {
    const limite = Date.now() + ESPERA_RESULTADO_CONCORRENTE_MS;
    while (Date.now() < limite) {
      await new Promise((resolver) => setTimeout(resolver, INTERVALO_POLLING_MS));
      const entrada = await this.cache.obter(cnpj);
      if (entrada) {
        return entrada;
      }
    }
    return null;
  }

  // Dado do provedor + IBGE (do proprio provedor, se a BrasilAPI respondeu; senao
  // da API de CEP, em cache de 30 dias) + id do municipio no Radar (mapa em
  // Redis). Falha em qualquer enriquecimento NAO derruba a consulta: o campo
  // fica null e o usuario completa pelo CEP no popup.
  private async montarEnderecoSugerido(
    dados: ConsultaCnpjDto,
  ): Promise<EnderecoSugeridoDto> {
    const { endereco } = dados;
    const cep = endereco.cep?.replace(/\D/g, '') ?? null;

    let codigoIbge: string | null = endereco.codigoIbge;
    let logradouroDoCep: string | null = null;
    if (!codigoIbge && cep && cep.length === 8) {
      try {
        const doCep = await this.consultaCepService.consultar(cep);
        codigoIbge = doCep.codigoIbge;
        logradouroDoCep = doCep.logradouro;
      } catch (error) {
        this.logger.warn(
          `CEP ${cep} do CNPJ nao resolvido: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    let idMunicipioErp: string | null = null;
    if (codigoIbge) {
      try {
        idMunicipioErp = await this.municipioWkService.idPorCodigoIbge(codigoIbge);
      } catch (error) {
        this.logger.warn(
          `Municipio IBGE ${codigoIbge} nao resolvido no Radar: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const numero = endereco.numero?.trim() ?? null;
    const semNumero = !numero || /^s\/?n$/i.test(numero);
    return {
      cep,
      logradouro: endereco.logradouro ?? logradouroDoCep,
      numero: semNumero ? null : numero,
      semNumero,
      complemento: endereco.complemento,
      bairro: endereco.bairro,
      municipio: endereco.municipio,
      uf: endereco.uf,
      codigoIbge,
      idMunicipioErp,
    };
  }
}
