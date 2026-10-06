import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { Cliente, Prisma } from '../../generated/prisma/client';
import { MunicipioWkService } from '../municipio-wk/municipio-wk.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';
import { ClienteCadastroService } from './cliente-cadastro.service';
import {
  CLIENTE_ALTERACAO_ERP_JOB_NAME,
  CLIENTE_ENVIO_ERP_BACKOFF_MS,
  CLIENTE_ENVIO_ERP_QUEUE,
  CLIENTE_ENVIO_ERP_TENTATIVAS,
  jobIdAlteracaoErp,
} from './cliente-envio-erp.constants';
import {
  aplicarNoPayloadDeCriacao,
  calcularIntencao,
  intencaoVazia,
  type EstadoEditavel,
  type IntencaoAlteracao,
} from './domain/alteracao-cliente';
import { tipoPessoaDoDocumento } from './domain/documento';
import type {
  AtualizarClienteDto,
  ClienteEdicaoDto,
  EnderecoEdicaoDto,
  ResultadoEdicaoDto,
} from './dto/atualizar-cliente.dto';
import { EnderecoClienteService } from './endereco-cliente.service';
import {
  enderecoBancoParaWk,
  mesmoLocal,
  type EnderecoParaWk,
  type TipoEndereco,
} from './endereco-wk';

type Objeto = Record<string, unknown>;

interface EnderecoDesejado {
  paraWk: EnderecoParaWk;
  paraBanco: Objeto;
}

// Edicao de cliente (web e mobile). Atualiza o Postgres na hora e leva a
// alteracao ao WK Radar pela fila:
//   - cliente que ainda NAO chegou ao Radar (cadastro pendente ou recusado):
//     a edicao reescreve o cadastro que vai ser enviado (POST) e ele volta pra
//     fila - e assim que se corrige um cadastro que o ERP recusou;
//   - cliente que ja esta no Radar: grava uma AlteracaoClienteErp (so o que
//     mudou) e o job aplica com PATCH (ver ClienteEnvioErpService).
// A decisao do que mudou e de como montar cada corpo vive no dominio
// (domain/alteracao-cliente.ts) - aqui so orquestra.
@Injectable()
export class ClienteEdicaoService {
  private readonly logger = new Logger(ClienteEdicaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enderecoClienteService: EnderecoClienteService,
    private readonly clienteCadastroService: ClienteCadastroService,
    private readonly municipioWkService: MunicipioWkService,
    @InjectQueue(CLIENTE_ENVIO_ERP_QUEUE) private readonly fila: Queue,
  ) {}

  async obterParaEdicao(
    clienteId: string,
    escopo: EscopoClientes,
  ): Promise<ClienteEdicaoDto> {
    const cliente = await this.buscarNoEscopo(clienteId, escopo);
    const brutos = this.enderecosBrutos(cliente);
    const padrao = brutos.find((e) => e.tipo === 'Padrao');
    const entrega = brutos.find((e) => e.tipo === 'Entrega');
    const padraoWk = enderecoBancoParaWk(padrao);
    const entregaWk = enderecoBancoParaWk(entrega);
    const cadastrais = this.camposPessoaFisicaDoCadastro(cliente);

    return {
      id: cliente.id,
      cpfCnpj: cliente.cpfCnpj,
      tipoPessoa: tipoPessoaDoDocumento(cliente.cpfCnpj ?? ''),
      codigo: cliente.codigo,
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      inscricaoEstadual: cliente.inscricaoEstadual,
      email: cliente.email,
      limiteCredito: cliente.limiteCredito?.toNumber() ?? null,
      rg: cadastrais?.rg ?? null,
      dataNascimento: cadastrais?.dataNascimento ?? null,
      nomeMae: cadastrais?.nomeMae ?? null,
      camposPessoaFisicaConhecidos: cadastrais !== null,
      enderecoCobranca: padrao ? await this.paraEnderecoEdicao(padrao) : null,
      enderecoEntrega: entrega ? await this.paraEnderecoEdicao(entrega) : null,
      // Sem endereco de entrega, ou com um igual ao de cobranca: "igual".
      entregaIgualCobranca:
        !entregaWk || (padraoWk !== null && mesmoLocal(padraoWk, entregaWk)),
      telefones: padraoWk?.telefones ?? [],
      statusEnvioErp: cliente.statusEnvioErp,
    };
  }

  async editar(
    clienteId: string,
    dto: AtualizarClienteDto,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<ResultadoEdicaoDto> {
    const cliente = await this.buscarNoEscopo(clienteId, escopo);
    const tipoPessoa = tipoPessoaDoDocumento(cliente.cpfCnpj ?? '');
    const atual = this.estadoEditavel(cliente);
    const enderecosDesejados = await this.montarEnderecosDesejados(dto, cliente);

    const intencao = calcularIntencao(atual, {
      razaoSocial: dto.razaoSocial,
      nomeFantasia: tipoPessoa === 'Fisica' ? undefined : dto.nomeFantasia,
      email: dto.email,
      inscricaoEstadual: dto.inscricaoEstadual,
      limiteCredito: dto.limiteCredito,
      ...(tipoPessoa === 'Fisica'
        ? { rg: dto.rg, dataNascimento: dto.dataNascimento, nomeMae: dto.nomeMae }
        : {}),
      enderecos: enderecosDesejados.map((endereco) => endereco.paraWk),
    });
    if (intencaoVazia(intencao)) {
      return { id: clienteId, situacao: 'SEM_ALTERACAO' };
    }

    const dadosLocais = this.dadosLocais(cliente, intencao, enderecosDesejados);
    const aindaNaoNoRadar =
      cliente.criadoLocalmente && cliente.idExternoErp.startsWith('PENDENTE-');

    if (aindaNaoNoRadar && cliente.payloadEnvioErp) {
      await this.clienteCadastroService.garantirEnvioParado(clienteId);
      const payload = aplicarNoPayloadDeCriacao(
        cliente.payloadEnvioErp as Objeto,
        intencao,
      );
      await this.prisma.cliente.update({
        where: { id: clienteId },
        data: {
          ...dadosLocais,
          payloadEnvioErp: payload as Prisma.InputJsonValue,
          statusEnvioErp: 'PENDENTE',
          erroEnvioErp: null,
        },
      });
      await this.clienteCadastroService.enfileirarEnvio(clienteId);
      return { id: clienteId, situacao: 'CADASTRO_PENDENTE' };
    }

    const alteracao = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(dadosLocais).length > 0) {
        await tx.cliente.update({ where: { id: clienteId }, data: dadosLocais });
      }
      return tx.alteracaoClienteErp.create({
        data: {
          clienteId,
          usuarioId,
          payload: intencao as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    });
    await this.enfileirarAlteracao(alteracao.id);
    return { id: clienteId, situacao: 'ALTERACAO_PENDENTE' };
  }

  // Tambem usado pelo scheduler que re-enfileira alteracao PENDENTE.
  async enfileirarAlteracao(alteracaoId: string): Promise<void> {
    try {
      await this.fila.add(
        CLIENTE_ALTERACAO_ERP_JOB_NAME,
        { alteracaoId },
        {
          jobId: jobIdAlteracaoErp(alteracaoId),
          attempts: CLIENTE_ENVIO_ERP_TENTATIVAS,
          backoff: { type: 'exponential', delay: CLIENTE_ENVIO_ERP_BACKOFF_MS },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      // A alteracao ja esta salva como PENDENTE - o scheduler re-enfileira.
      this.logger.error(
        `Falha ao enfileirar alteracao ${alteracaoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // IDOR: confirma que o cliente esta na carteira de quem chama NA PROPRIA
  // query; 404 tanto pra "nao existe" quanto pra "fora do escopo".
  private async buscarNoEscopo(clienteId: string, escopo: EscopoClientes): Promise<Cliente> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    const cliente = whereEscopo
      ? await this.prisma.cliente.findFirst({ where: { id: clienteId, ...whereEscopo } })
      : null;
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }
    return cliente;
  }

  private enderecosBrutos(cliente: Cliente): Objeto[] {
    const lista: unknown[] = Array.isArray(cliente.enderecos) ? cliente.enderecos : [];
    return lista.filter(
      (e): e is Objeto => typeof e === 'object' && e !== null && !Array.isArray(e),
    );
  }

  // RG/nascimento/mae so existem pra cliente cadastrado por nos (no corpo do
  // POST); o sync nao grava esses campos.
  private camposPessoaFisicaDoCadastro(
    cliente: Cliente,
  ): { rg: string | null; dataNascimento: string | null; nomeMae: string | null } | null {
    if (!cliente.criadoLocalmente || !cliente.payloadEnvioErp) return null;
    const cadastrais =
      ((cliente.payloadEnvioErp as Objeto).informacoesCadastrais as Objeto | undefined) ?? {};
    const texto = (valor: unknown) => (typeof valor === 'string' ? valor : null);
    return {
      rg: texto(cadastrais.rg),
      dataNascimento: texto(cadastrais.dataNascimento),
      nomeMae: texto(cadastrais.nomeMae),
    };
  }

  private estadoEditavel(cliente: Cliente): EstadoEditavel {
    const cadastrais = this.camposPessoaFisicaDoCadastro(cliente);
    return {
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      email: cliente.email,
      inscricaoEstadual: cliente.inscricaoEstadual,
      limiteCredito: cliente.limiteCredito?.toNumber() ?? null,
      rg: cadastrais?.rg ?? null,
      dataNascimento: cadastrais?.dataNascimento ?? null,
      nomeMae: cadastrais?.nomeMae ?? null,
      enderecos: this.enderecosBrutos(cliente)
        .map(enderecoBancoParaWk)
        .filter((e): e is EnderecoParaWk => e !== null),
    };
  }

  // O que a tela pediu pra cada endereco (cobranca = Padrao, entrega =
  // Entrega). Endereco que a tela nao mandou nao entra (fica como esta).
  private async montarEnderecosDesejados(
    dto: AtualizarClienteDto,
    cliente: Cliente,
  ): Promise<EnderecoDesejado[]> {
    const brutos = this.enderecosBrutos(cliente);
    const bruto = (tipo: TipoEndereco) => brutos.find((e) => e.tipo === tipo);
    const atualPadrao = enderecoBancoParaWk(bruto('Padrao'));
    const atualEntrega = enderecoBancoParaWk(bruto('Entrega'));
    const desejados: EnderecoDesejado[] = [];

    let padrao: EnderecoDesejado | null = null;
    if (dto.enderecoCobranca) {
      padrao = await this.enderecoClienteService.resolver(
        'Padrao',
        dto.enderecoCobranca,
        dto.telefones ?? atualPadrao?.telefones ?? [],
      );
    } else if (dto.telefones && atualPadrao) {
      padrao = {
        paraWk: { ...atualPadrao, telefones: dto.telefones },
        paraBanco: { ...bruto('Padrao'), telefones: dto.telefones },
      };
    }
    if (padrao) desejados.push(padrao);

    if (dto.entregaIgualCobranca === true) {
      // So acompanha a cobranca se o cliente TEM endereco de entrega - nao cria
      // um endereco novo no ERP so porque a caixa esta marcada.
      const base =
        padrao ?? (atualPadrao ? { paraWk: atualPadrao, paraBanco: bruto('Padrao')! } : null);
      if (atualEntrega && base) {
        desejados.push({
          paraWk: {
            ...base.paraWk,
            tipo: 'Entrega',
            telefones: atualEntrega.telefones,
            email: atualEntrega.email,
          },
          paraBanco: {
            ...base.paraBanco,
            tipo: 'Entrega',
            telefones: atualEntrega.telefones,
            email: atualEntrega.email ?? null,
          },
        });
      }
    } else if (dto.enderecoEntrega) {
      desejados.push(
        await this.enderecoClienteService.resolver(
          'Entrega',
          dto.enderecoEntrega,
          atualEntrega?.telefones ?? [],
        ),
      );
    }
    return desejados;
  }

  // Colunas do Postgres que mudam ja (a tela mostra o valor novo enquanto a
  // alteracao vai pro ERP).
  private dadosLocais(
    cliente: Cliente,
    intencao: IntencaoAlteracao,
    enderecosDesejados: EnderecoDesejado[],
  ): Prisma.ClienteUpdateInput {
    const dados: Prisma.ClienteUpdateInput = {};
    if (intencao.razaoSocial !== undefined) dados.razaoSocial = intencao.razaoSocial;
    if (intencao.nomeFantasia !== undefined) dados.nomeFantasia = intencao.nomeFantasia || null;
    if (intencao.email !== undefined) dados.email = intencao.email || null;
    if (intencao.inscricaoEstadual !== undefined) {
      dados.inscricaoEstadual = intencao.inscricaoEstadual || null;
    }
    if (intencao.limiteCredito !== undefined) dados.limiteCredito = intencao.limiteCredito;
    if (intencao.enderecos?.length) {
      const enderecos = [...this.enderecosBrutos(cliente)];
      for (const alterado of intencao.enderecos) {
        const novo = enderecosDesejados.find((d) => d.paraWk.tipo === alterado.tipo)!.paraBanco;
        const indice = enderecos.findIndex((e) => e.tipo === alterado.tipo);
        if (indice === -1) {
          enderecos.push(novo);
        } else {
          enderecos[indice] = novo;
        }
      }
      dados.enderecos = enderecos as Prisma.InputJsonValue;
    }
    return dados;
  }

  private async paraEnderecoEdicao(bruto: Objeto): Promise<EnderecoEdicaoDto> {
    const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '');
    const idMunicipio = texto(bruto.idMunicipio);
    let cidade = '';
    if (idMunicipio) {
      try {
        cidade = (await this.municipioWkService.nomePorId(idMunicipio)) ?? '';
      } catch {
        cidade = '';
      }
    }
    const semNumero = bruto.semNumero === true;
    return {
      cep: texto(bruto.cep).replace(/\D/g, ''),
      logradouro: texto(bruto.nomeEndereco),
      numero: !semNumero && typeof bruto.numero === 'number' ? String(bruto.numero) : '',
      semNumero,
      complemento: texto(bruto.complemento),
      bairro: texto(bruto.bairro),
      cidade,
      uf: texto(bruto.uf),
      codigoIbge: texto(bruto.codigoIBGE) || null,
      idMunicipio,
    };
  }
}
