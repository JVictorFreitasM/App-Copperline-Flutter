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
import { ConfiguracaoFuncionalidadesService } from '../configuracoes/configuracao-funcionalidades.service';
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
import type { ClienteCriadoDto, CriarClienteDto } from './dto/criar-cliente.dto';
import { EnderecoClienteService } from './endereco-cliente.service';
import { montarPayloadWkCliente } from './montar-payload-wk-cliente';

// Cadastro de cliente novo: valida, grava no Postgres (o cliente ja aparece na
// carteira de quem cadastrou, com status PENDENTE) e enfileira o envio ao WK
// Radar (job `cliente.enviar-erp`, ver ClienteEnvioErpService). Fluxo
// separado do pipeline de leitura/sync, como manda o CLAUDE.md.
@Injectable()
export class ClienteCadastroService {
  private readonly logger = new Logger(ClienteCadastroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enderecoClienteService: EnderecoClienteService,
    @InjectQueue(CLIENTE_ENVIO_ERP_QUEUE) private readonly fila: Queue,
    private readonly funcionalidades: ConfiguracaoFuncionalidadesService,
  ) {}

  async criar(
    dto: CriarClienteDto,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<ClienteCriadoDto> {
    if (escopo.tipo === 'NENHUM') {
      throw new ForbiddenException('Usuário sem permissão para cadastrar clientes');
    }
    const { cadastroClientesHabilitado } = await this.funcionalidades.obter();
    if (!cadastroClientesHabilitado) {
      throw new ForbiddenException(
        'Cadastro de clientes está desativado no momento - fale com o admin (Configurações > Funcionalidades).',
      );
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

    // Telefones do cliente vao no endereco de cobranca (o Radar guarda telefone
    // dentro do endereco).
    const cobranca = await this.enderecoClienteService.resolver(
      'Padrao',
      dto.enderecoCobranca,
      [...(dto.enderecoCobranca.telefones ?? []), ...(dto.telefones ?? [])],
    );
    const entrega = dto.enderecoEntrega
      ? await this.enderecoClienteService.resolver(
          'Entrega',
          dto.enderecoEntrega,
          dto.enderecoEntrega.telefones ?? [],
        )
      : null;
    const enderecos = entrega ? [cobranca, entrega] : [cobranca];
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
      enderecos: enderecos.map((endereco) => endereco.paraWk),
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
          enderecos: enderecos.map(
            (endereco) => endereco.paraBanco,
          ) as unknown as Prisma.InputJsonValue,
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
  // backend reiniciado no meio) e pela edicao de um cadastro ainda nao enviado.
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

  // Antes de editar um cadastro que ainda nao chegou ao Radar: recusa se o
  // envio esta EM ANDAMENTO agora (o job ja leu o payload antigo) e tira da
  // fila o job antigo parado (falho/aguardando nova tentativa) - com o mesmo
  // jobId, o BullMQ ignoraria o envio novo.
  async garantirEnvioParado(clienteId: string): Promise<void> {
    const job = await this.fila.getJob(jobIdEnvioErp(clienteId));
    if (!job) return;
    if (await job.isActive()) {
      throw new ConflictException(
        'O cadastro deste cliente está sendo enviado ao ERP agora - tente de novo em instantes',
      );
    }
    await job.remove();
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
}
