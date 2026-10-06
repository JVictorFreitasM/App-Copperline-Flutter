import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { ConsultaCepService } from '../consulta-cep/consulta-cep.service';
import { MunicipioWkService } from '../municipio-wk/municipio-wk.service';
import { PrismaService } from '../prisma/prisma.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import {
  CLIENTE_ENVIO_ERP_BACKOFF_MS,
  CLIENTE_ENVIO_ERP_JOB_NAME,
  CLIENTE_ENVIO_ERP_QUEUE,
  CLIENTE_ENVIO_ERP_TENTATIVAS,
  jobIdEnvioErp,
} from './cliente-envio-erp.constants';
import {
  formatarDocumento,
  tipoPessoaDoDocumento,
  variantesParaBusca,
} from './domain/documento';
import type {
  ClienteCriadoDto,
  CriarClienteDto,
  EnderecoClienteDto,
  TelefoneClienteDto,
} from './dto/criar-cliente.dto';
import {
  montarPayloadWkCliente,
  type EnderecoParaWk,
} from './montar-payload-wk-cliente';

// Cadastro de cliente novo: valida, grava no Postgres (o cliente ja aparece na
// carteira de quem cadastrou, com status PENDENTE) e enfileira o envio ao WK
// Radar (job `cliente.enviar-erp`, ver ClienteEnvioErpService). Fluxo
// separado do pipeline de leitura/sync, como manda o CLAUDE.md.
@Injectable()
export class ClienteCadastroService {
  private readonly logger = new Logger(ClienteCadastroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly municipioWkService: MunicipioWkService,
    private readonly consultaCepService: ConsultaCepService,
    @InjectQueue(CLIENTE_ENVIO_ERP_QUEUE) private readonly fila: Queue,
  ) {}

  async criar(
    dto: CriarClienteDto,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<ClienteCriadoDto> {
    if (escopo.tipo === 'NENHUM') {
      throw new ForbiddenException('Usuário sem permissão para cadastrar clientes');
    }

    const tipoPessoa = tipoPessoaDoDocumento(dto.cpfCnpj);
    if (!tipoPessoa) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }
    // A validacao do DTO ja exige, mas a regra vale tambem pra quem chamar o
    // servico direto (fila, outros modulos).
    if (!dto.contatos || dto.contatos.length === 0) {
      throw new BadRequestException('Adicione pelo menos um contato');
    }
    const documentoFormatado = formatarDocumento(dto.cpfCnpj);

    await this.garantirDocumentoInedito(dto.cpfCnpj);

    // O cliente novo precisa nascer VINCULADO a quem cadastrou - senao ele
    // some da propria carteira (escopo por vendedor) e o sync, que recria o
    // vinculo a partir do Radar, o apagaria. Admin sem vendedor cadastra sem
    // vinculo.
    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
      select: { id: true, idExternoErp: true },
    });
    if (!vendedor && escopo.tipo !== 'TODOS') {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado',
      );
    }

    const enderecos = await this.resolverEnderecos(dto);
    const clienteId = randomUUID();

    const payload = montarPayloadWkCliente({
      clienteId,
      documentoFormatado,
      tipoPessoa,
      codigo: dto.codigo,
      razaoSocial: dto.razaoSocial.trim(),
      nomeFantasia: dto.nomeFantasia?.trim() || undefined,
      inscricaoEstadual: dto.inscricaoEstadual?.trim() || undefined,
      rg: dto.rg?.trim() || undefined,
      dataNascimento: dto.dataNascimento,
      nomeMae: dto.nomeMae?.trim() || undefined,
      email: dto.email,
      limiteCredito: dto.limiteCredito,
      enderecos: enderecos.paraWk,
      contatos: dto.contatos.map((contato) => ({
        nome: contato.nome.trim(),
        funcao: contato.funcao,
        email: contato.email,
        telefoneDdd: contato.telefoneDdd,
        telefoneNumero: contato.telefoneNumero,
        dataNascimento: contato.dataNascimento,
      })),
      vendedorIdExterno: vendedor?.idExternoErp ?? null,
    });

    const pino = dto.enderecoCobranca;
    const temPino = pino.latitude !== undefined && pino.longitude !== undefined;
    const agora = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.cliente.create({
        data: {
          id: clienteId,
          // Valor sintetico: a coluna e' unica e obrigatoria. O sync (por
          // codigoIntegrador) ou o job de envio trocam pelo id real do Radar.
          idExternoErp: `PENDENTE-${clienteId}`,
          codigoIntegrador: clienteId,
          codigo: dto.codigo ?? null,
          cpfCnpj: documentoFormatado,
          razaoSocial: dto.razaoSocial.trim(),
          nomeFantasia: dto.nomeFantasia?.trim() || null,
          inscricaoEstadual: dto.inscricaoEstadual?.trim() || null,
          email: dto.email ?? null,
          enderecos: enderecos.paraBanco as unknown as Prisma.InputJsonValue,
          limiteCredito: dto.limiteCredito ?? null,
          incompleto: false,
          sincronizadoEm: agora,
          statusEnvioErp: 'PENDENTE',
          payloadEnvioErp: payload as unknown as Prisma.InputJsonValue,
          criadoLocalmente: true,
          ...(temPino
            ? {
                localizacaoLat: pino.latitude,
                localizacaoLng: pino.longitude,
                localizacaoDefinidaEm: agora,
                localizacaoDefinidaPorId: vendedor?.id ?? null,
              }
            : {}),
        },
      });

      for (const contato of dto.contatos) {
        await tx.contatoCliente.create({
          data: {
            idExternoErp: `LOCAL-${randomUUID()}`,
            clienteId,
            nome: contato.nome.trim(),
            email: contato.email ?? null,
            telefoneDdd: contato.telefoneDdd ?? null,
            telefoneNumero: contato.telefoneNumero ?? null,
            funcao: contato.funcao ?? null,
            criadoLocalmente: true,
            sincronizadoEm: agora,
          },
        });
      }

      if (vendedor) {
        await tx.clienteVendedor.create({
          data: { clienteId, vendedorId: vendedor.id },
        });
      }
    });

    await this.enfileirarEnvio(clienteId);
    return { id: clienteId, statusEnvioErp: 'PENDENTE' };
  }

  // Tambem usado pelo scheduler que re-enfileira PENDENTE (Redis perdido,
  // backend reiniciado no meio).
  async enfileirarEnvio(clienteId: string): Promise<void> {
    try {
      await this.fila.add(
        CLIENTE_ENVIO_ERP_JOB_NAME,
        { clienteId },
        {
          jobId: jobIdEnvioErp(clienteId),
          attempts: CLIENTE_ENVIO_ERP_TENTATIVAS,
          backoff: { type: 'exponential', delay: CLIENTE_ENVIO_ERP_BACKOFF_MS },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      // O cliente ja esta salvo como PENDENTE - o scheduler re-enfileira.
      this.logger.error(
        `Falha ao enfileirar envio do cliente ${clienteId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async garantirDocumentoInedito(documento: string): Promise<void> {
    // O sync grava cpf_cnpj formatado - busca nas duas formas.
    const existente = await this.prisma.cliente.findFirst({
      where: { cpfCnpj: { in: variantesParaBusca(documento) } },
      select: {
        vendedores: {
          take: 1,
          orderBy: { criadoEm: 'asc' },
          select: { vendedor: { select: { nome: true } } },
        },
      },
    });
    if (existente) {
      const responsavel = existente.vendedores[0]?.vendedor.nome;
      throw new ConflictException(
        responsavel
          ? `Cliente já cadastrado - vendedor responsável: ${responsavel}`
          : 'Cliente já cadastrado',
      );
    }
  }

  private async resolverEnderecos(dto: CriarClienteDto): Promise<{
    paraWk: EnderecoParaWk[];
    paraBanco: Record<string, unknown>[];
  }> {
    const telefonesDoCliente = dto.telefones ?? [];
    const entradas: { tipo: 'Padrao' | 'Entrega'; endereco: EnderecoClienteDto }[] = [
      { tipo: 'Padrao', endereco: dto.enderecoCobranca },
      ...(dto.enderecoEntrega
        ? [{ tipo: 'Entrega' as const, endereco: dto.enderecoEntrega }]
        : []),
    ];

    const paraWk: EnderecoParaWk[] = [];
    const paraBanco: Record<string, unknown>[] = [];
    for (const { tipo, endereco } of entradas) {
      const { idMunicipio, codigoIbge } = await this.resolverMunicipio(endereco);
      const telefones: TelefoneClienteDto[] = [
        ...(endereco.telefones ?? []),
        ...(tipo === 'Padrao' ? telefonesDoCliente : []),
      ];
      const semNumero = endereco.semNumero === true || endereco.numero === undefined;

      paraWk.push({
        tipo,
        cep: endereco.cep,
        logradouro: endereco.logradouro.trim(),
        numero: endereco.numero,
        semNumero,
        complemento: endereco.complemento?.trim() || undefined,
        bairro: endereco.bairro.trim(),
        idMunicipio,
        telefones,
        email: endereco.email,
      });
      // Mesmas chaves que o sync grava a partir do Radar - o resto do sistema
      // le `enderecos` sem distinguir se a linha e' local ou sincronizada.
      paraBanco.push({
        tipo,
        cep: `${endereco.cep.slice(0, 5)}-${endereco.cep.slice(5)}`,
        nomeEndereco: endereco.logradouro.trim(),
        numero: semNumero ? 0 : endereco.numero,
        semNumero,
        complemento: endereco.complemento?.trim() ?? '',
        bairro: endereco.bairro.trim(),
        idMunicipio,
        uf: endereco.uf?.toUpperCase() ?? null,
        codigoIBGE: codigoIbge,
        telefones,
        email: endereco.email ?? null,
      });
    }
    return { paraWk, paraBanco };
  }

  // idMunicipio do Radar: direto, ou via IBGE, ou via CEP -> IBGE. O front ja
  // manda o IBGE (vem da consulta de CEP), mas o backend nao depende disso.
  private async resolverMunicipio(
    endereco: EnderecoClienteDto,
  ): Promise<{ idMunicipio: string; codigoIbge: string | null }> {
    let codigoIbge = endereco.codigoIbge ?? null;
    if (endereco.idMunicipio) {
      return { idMunicipio: endereco.idMunicipio, codigoIbge };
    }

    if (!codigoIbge) {
      try {
        codigoIbge = (await this.consultaCepService.consultar(endereco.cep)).codigoIbge;
      } catch {
        codigoIbge = null;
      }
    }
    const idMunicipio = codigoIbge
      ? await this.municipioWkService.idPorCodigoIbge(codigoIbge)
      : null;
    if (!idMunicipio) {
      throw new BadRequestException(
        `Não foi possível identificar o município do CEP ${endereco.cep} - confira o CEP`,
      );
    }
    return { idMunicipio, codigoIbge };
  }
}
