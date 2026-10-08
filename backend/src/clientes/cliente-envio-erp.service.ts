import { Injectable, Logger } from '@nestjs/common';
import { ConfiguracaoFuncionalidadesService } from '../configuracoes/configuracao-funcionalidades.service';
import { AxiosError } from 'axios';
import { UnrecoverableError } from 'bullmq';
import { ErpClientService } from '../erp-client/erp-client.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  montarPatchWk,
  type ClienteRadarAtual,
  type IntencaoAlteracao,
} from './domain/alteracao-cliente';

const CAMINHO_CLIENTE = '/empresarial/v1/cliente';

export type ResultadoEnvioErp = 'ENVIADO' | 'IGNORADO' | 'DESABILITADO' | 'ADIADO';

// Escreve no WK Radar o que o app fez no cliente: o cadastro novo (POST
// /empresarial/v1/cliente, recebe um ARRAY e responde [{id, codigoIntegrador}])
// e as edicoes (PATCH /empresarial/v1/cliente/{id}, responde 204). Escrita no
// ERP e' fluxo separado da leitura/sync, com fila e tratamento de erro proprios
// (CLAUDE.md).
//
// Desligado por padrao (Configuracoes > Funcionalidades; antes de decidirem la, vale a env CLIENTE_ENVIO_ERP_HABILITADO): escrever num ERP e'
// acao irreversivel e o formato exato da resposta/validacao do POST ainda nao
// foi confirmado contra o ambiente real - o primeiro envio e' feito de
// proposito, com alguem acompanhando. Desligado, o cliente fica PENDENTE e o
// scheduler tenta de novo quando ligarem.
@Injectable()
export class ClienteEnvioErpService {
  private readonly logger = new Logger(ClienteEnvioErpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly erpClient: ErpClientService,
    private readonly funcionalidades: ConfiguracaoFuncionalidadesService,
  ) {}

  async enviar(
    clienteId: string,
    ultimaTentativa: boolean,
  ): Promise<ResultadoEnvioErp> {
    if (!(await this.envioHabilitado())) {
      this.logger.warn(
        `Envio de cliente ao ERP desabilitado (Configuracoes > Funcionalidades) - ${clienteId} segue PENDENTE`,
      );
      return 'DESABILITADO';
    }

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { statusEnvioErp: true, payloadEnvioErp: true },
    });
    if (!cliente || cliente.statusEnvioErp === 'ENVIADO' || !cliente.payloadEnvioErp) {
      return 'IGNORADO';
    }

    let resposta: unknown;
    try {
      resposta = await this.erpClient.post<unknown>(CAMINHO_CLIENTE, [
        cliente.payloadEnvioErp,
      ]);
    } catch (error) {
      const mensagem = mensagemDoErro(error);
      if (ehErroDeNegocio(error)) {
        // O ERP respondeu e recusou o cadastro - repetir igual so repete a
        // recusa (ex: CNPJ ja existe, campo invalido).
        await this.marcarErro(clienteId, mensagem);
        throw new UnrecoverableError(mensagem);
      }
      if (ultimaTentativa) {
        await this.marcarErro(clienteId, mensagem);
      }
      throw error;
    }

    const idExterno = extrairIdCriado(resposta);
    await this.marcarEnviado(clienteId, idExterno);
    return 'ENVIADO';
  }

  // Edicao de um cliente que ja esta no Radar. Le o cliente ATUAL no Radar e
  // manda cada bloco tocado completo (montarPatchWk) - o PATCH com bloco
  // parcial poderia apagar o que nao editamos.
  async enviarAlteracao(
    alteracaoId: string,
    ultimaTentativa: boolean,
  ): Promise<ResultadoEnvioErp> {
    if (!(await this.envioHabilitado())) {
      this.logger.warn(
        `Envio de cliente ao ERP desabilitado (Configuracoes > Funcionalidades) - alteracao ${alteracaoId} segue PENDENTE`,
      );
      return 'DESABILITADO';
    }

    const alteracao = await this.prisma.alteracaoClienteErp.findUnique({
      where: { id: alteracaoId },
      select: {
        clienteId: true,
        status: true,
        payload: true,
        criadoEm: true,
        cliente: { select: { idExternoErp: true } },
      },
    });
    if (!alteracao || alteracao.status !== 'PENDENTE') {
      return 'IGNORADO';
    }
    const idExterno = alteracao.cliente.idExternoErp;
    if (idExterno.startsWith('PENDENTE-')) {
      await this.marcarErroAlteracao(alteracaoId, 'Cliente ainda não existe no ERP');
      return 'IGNORADO';
    }

    // Ordem: com retentativas, uma alteracao mais nova poderia passar na frente
    // de uma antiga e ser sobrescrita por ela. Enquanto houver anterior
    // pendente do mesmo cliente, esta espera (sem virar ERRO por isso).
    const anterior = await this.prisma.alteracaoClienteErp.findFirst({
      where: {
        clienteId: alteracao.clienteId,
        status: 'PENDENTE',
        criadoEm: { lt: alteracao.criadoEm },
      },
      select: { id: true },
    });
    if (anterior) {
      if (ultimaTentativa) {
        return 'ADIADO';
      }
      throw new Error('Aguardando a alteração anterior do mesmo cliente');
    }

    const caminho = `${CAMINHO_CLIENTE}/${encodeURIComponent(idExterno)}`;
    try {
      const lido = await this.erpClient.get<ClienteRadarAtual | ClienteRadarAtual[]>(caminho);
      const atual = Array.isArray(lido) ? lido[0] : lido;
      if (!atual) {
        await this.marcarErroAlteracao(alteracaoId, 'Cliente não encontrado no ERP');
        throw new UnrecoverableError('Cliente não encontrado no ERP');
      }
      const patch = montarPatchWk(atual, alteracao.payload as IntencaoAlteracao);
      await this.erpClient.patch<unknown>(caminho, patch);
    } catch (error) {
      if (error instanceof UnrecoverableError) {
        throw error;
      }
      const mensagem = mensagemDoErro(error);
      if (ehErroDeNegocio(error)) {
        await this.marcarErroAlteracao(alteracaoId, mensagem);
        throw new UnrecoverableError(mensagem);
      }
      if (ultimaTentativa) {
        await this.marcarErroAlteracao(alteracaoId, mensagem);
      }
      throw error;
    }

    await this.prisma.alteracaoClienteErp.update({
      where: { id: alteracaoId },
      data: { status: 'ENVIADO', erro: null, enviadoEm: new Date() },
    });
    return 'ENVIADO';
  }

  private async envioHabilitado(): Promise<boolean> {
    return (await this.funcionalidades.obter()).envioClientesErpHabilitado;
  }

  private async marcarErroAlteracao(alteracaoId: string, mensagem: string): Promise<void> {
    await this.prisma.alteracaoClienteErp.update({
      where: { id: alteracaoId },
      data: { status: 'ERRO', erro: mensagem.slice(0, 1000) },
    });
  }

  private async marcarErro(clienteId: string, mensagem: string): Promise<void> {
    await this.prisma.cliente.update({
      where: { id: clienteId },
      data: { statusEnvioErp: 'ERRO', erroEnvioErp: mensagem.slice(0, 1000) },
    });
  }

  private async marcarEnviado(
    clienteId: string,
    idExterno: string | null,
  ): Promise<void> {
    // So troca o id sintetico pelo real se nenhuma outra linha ja o usa (o
    // sync pode ter chegado primeiro) - senao deixa pro sync reconciliar.
    const idLivre =
      idExterno !== null &&
      (await this.prisma.cliente.findUnique({
        where: { idExternoErp: idExterno },
        select: { id: true },
      })) === null;

    await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        statusEnvioErp: 'ENVIADO',
        erroEnvioErp: null,
        ...(idLivre ? { idExternoErp: idExterno } : {}),
      },
    });
  }
}

// Erro 4xx (exceto 408/429) = o ERP entendeu e recusou; o resto (rede, 5xx,
// 429, timeout) e' transitorio e o job tenta de novo.
function ehErroDeNegocio(error: unknown): boolean {
  if (!(error instanceof AxiosError) || !error.response) {
    return false;
  }
  const { status } = error.response;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function mensagemDoErro(error: unknown): string {
  if (error instanceof AxiosError) {
    const dados: unknown = error.response?.data;
    if (typeof dados === 'string' && dados.trim()) {
      return dados;
    }
    if (dados && typeof dados === 'object') {
      const texto = JSON.stringify(dados);
      return texto.length > 2 ? texto : error.message;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

// A resposta do POST nao foi confirmada contra o ambiente real - le o id de
// forma defensiva (objeto, array de objetos ou lista de ids). Sem id, o sync
// reconcilia pelo codigoIntegrador.
export function extrairIdCriado(resposta: unknown): string | null {
  const primeiro = Array.isArray(resposta) ? resposta[0] : resposta;
  if (typeof primeiro === 'string' && primeiro) {
    return primeiro;
  }
  if (primeiro && typeof primeiro === 'object') {
    const id = (primeiro as { id?: unknown }).id;
    if (typeof id === 'string' && id) {
      return id;
    }
  }
  return null;
}
