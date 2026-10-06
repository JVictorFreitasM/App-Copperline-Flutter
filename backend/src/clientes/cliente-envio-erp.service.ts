import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { UnrecoverableError } from 'bullmq';
import { ErpClientService } from '../erp-client/erp-client.service';
import { PrismaService } from '../prisma/prisma.service';

const CAMINHO_CLIENTE = '/empresarial/v1/cliente';

export type ResultadoEnvioErp = 'ENVIADO' | 'IGNORADO' | 'DESABILITADO';

// Envia ao WK Radar o cliente cadastrado localmente (POST /empresarial/v1/
// cliente, recebe um ARRAY). Escrita no ERP e' fluxo separado da leitura/sync,
// com fila e tratamento de erro proprios (CLAUDE.md).
//
// Desligado por padrao (CLIENTE_ENVIO_ERP_HABILITADO): escrever num ERP e'
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
    private readonly configService: ConfigService,
  ) {}

  async enviar(
    clienteId: string,
    ultimaTentativa: boolean,
  ): Promise<ResultadoEnvioErp> {
    if (this.configService.get<string>('CLIENTE_ENVIO_ERP_HABILITADO') !== 'true') {
      this.logger.warn(
        `Envio de cliente ao ERP desabilitado (CLIENTE_ENVIO_ERP_HABILITADO) - ${clienteId} segue PENDENTE`,
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
