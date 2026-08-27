import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../../generated/prisma/client';
import { ErpClientService } from '../../erp-client/erp-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { buscarPorJanelas } from '../paginacao-por-janela';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';
import type { ClienteMapeado, WkRadarCliente } from './cliente.types';

// ErpClientService.baseUrl ja inclui {host}/wk.api/api (ver skill
// wk-radar-client, secao "Base de URL") - aqui so o sufixo do recurso.
const ROTA_CLIENTE = '/empresarial/v1/cliente';

const CAMPOS_CLIENTE = [
  'id',
  'codigoIntegrador',
  'cpfCnpj',
  'razaoSocial',
  'nomeFantasia',
  'inativo',
  'enderecos',
  'contatos.id',
  'contatos.codigoIntegrador',
  'contatos.nome',
  'contatos.email',
  'contatos.telefoneDDD',
  'contatos.telefoneNumero',
  'contatos.funcao',
  'detalhes.idVendedores',
  'informacoesFinanceiras.limiteCredito',
  'informacoesFinanceiras.dataLimiteCredito',
];

const TAMANHO_JANELA_PADRAO_MS = 24 * 60 * 60 * 1000; // 1 dia

@Injectable()
export class ClienteSyncStrategy implements SyncStrategy<
  WkRadarCliente,
  ClienteMapeado
> {
  readonly nomeEntidade = 'cliente';
  private readonly logger = new Logger(ClienteSyncStrategy.name);
  private readonly tamanhoJanelaMs: number;

  constructor(
    private readonly erpClient: ErpClientService,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.tamanhoJanelaMs = Number(
      configService.get('WK_RADAR_JANELA_CLIENTE_MS') ??
        TAMANHO_JANELA_PADRAO_MS,
    );
  }

  async fetch(janela: SyncWindow): Promise<SyncFetchResultado<WkRadarCliente>> {
    // Cliente tem par de datas (DataHoraGravacaoInicial/Final) - cada
    // sub-janela vira uma chamada com intervalo fechado, reduzindo de fato
    // o volume por resposta (ver skill wk-radar-client, secao "Paginacao").
    return buscarPorJanelas(janela, this.tamanhoJanelaMs, (subJanela) =>
      this.erpClient.get<WkRadarCliente[]>(ROTA_CLIENTE, {
        DataHoraGravacaoInicial: formatarDataWkRadar(subJanela.desde),
        DataHoraGravacaoFinal: formatarDataWkRadar(subJanela.ate),
        Fields: CAMPOS_CLIENTE,
      }),
    );
  }

  map(bruto: WkRadarCliente): ClienteMapeado {
    return {
      idExternoErp: bruto.id,
      codigoIntegrador: bruto.codigoIntegrador ?? null,
      cpfCnpj: bruto.cpfCnpj ?? null,
      razaoSocial: bruto.razaoSocial ?? null,
      nomeFantasia: bruto.nomeFantasia ?? null,
      inativo: bruto.inativo,
      enderecos: bruto.enderecos ?? [],
      contatos: (bruto.contatos ?? []).map((contato) => ({
        idExternoErp: contato.id,
        codigoIntegrador: contato.codigoIntegrador ?? null,
        nome: contato.nome ?? null,
        email: contato.email ?? null,
        telefoneDdd: contato.telefoneDDD ?? null,
        telefoneNumero: contato.telefoneNumero ?? null,
        funcao: contato.funcao ?? null,
      })),
      vendedoresExternoIds: bruto.detalhes?.idVendedores ?? [],
      limiteCredito: bruto.informacoesFinanceiras?.limiteCredito ?? null,
      dataLimiteCredito: bruto.informacoesFinanceiras?.dataLimiteCredito
        ? new Date(bruto.informacoesFinanceiras.dataLimiteCredito)
        : null,
    };
  }

  async upsert(mapeado: ClienteMapeado): Promise<void> {
    const sincronizadoEm = new Date();
    const enderecos = mapeado.enderecos as unknown as Prisma.InputJsonValue;

    await this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.upsert({
        where: { idExternoErp: mapeado.idExternoErp },
        create: {
          idExternoErp: mapeado.idExternoErp,
          codigoIntegrador: mapeado.codigoIntegrador,
          cpfCnpj: mapeado.cpfCnpj,
          razaoSocial: mapeado.razaoSocial,
          nomeFantasia: mapeado.nomeFantasia,
          inativo: mapeado.inativo,
          enderecos,
          incompleto: false,
          sincronizadoEm,
          limiteCredito: mapeado.limiteCredito,
          dataLimiteCredito: mapeado.dataLimiteCredito,
        },
        // incompleto:false tambem no update - "completa" um eventual stub
        // criado por PedidoSyncStrategy (OS 07) quando o cliente de verdade
        // chega aqui.
        update: {
          codigoIntegrador: mapeado.codigoIntegrador,
          cpfCnpj: mapeado.cpfCnpj,
          razaoSocial: mapeado.razaoSocial,
          nomeFantasia: mapeado.nomeFantasia,
          inativo: mapeado.inativo,
          enderecos,
          incompleto: false,
          sincronizadoEm,
          limiteCredito: mapeado.limiteCredito,
          dataLimiteCredito: mapeado.dataLimiteCredito,
        },
      });

      for (const contato of mapeado.contatos) {
        await tx.contatoCliente.upsert({
          where: { idExternoErp: contato.idExternoErp },
          create: { ...contato, clienteId: cliente.id, sincronizadoEm },
          update: { ...contato, clienteId: cliente.id, sincronizadoEm },
        });
      }

      // N:N com vendedor (OS-BACKEND-23) - recriado do zero a cada sync,
      // mesmo padrao ja usado em NotaFiscalPedido (ver nota-fiscal.sync.ts):
      // mais simples e correto do que diffar contra o estado anterior.
      await tx.clienteVendedor.deleteMany({ where: { clienteId: cliente.id } });
      for (const idVendedorExterno of mapeado.vendedoresExternoIds) {
        const vendedorId = await this.resolverOuCriarVendedorStub(
          tx,
          idVendedorExterno,
        );
        await tx.clienteVendedor.create({
          data: { clienteId: cliente.id, vendedorId },
        });
      }
    });
  }

  // Mesmo padrao ja usado por NotaFiscalSyncStrategy pra pedido (OS 09): se
  // o cliente referenciar um vendedor que este sistema ainda nao
  // sincronizou, cria um stub (incompleto=true, so id_externo_erp) em vez
  // de perder o vinculo. vendedor.sync.ts completa os dados e zera
  // incompleto quando sincronizar esse vendedor de verdade.
  private async resolverOuCriarVendedorStub(
    tx: PrismaTx,
    idExternoErp: string,
  ): Promise<string> {
    const vendedor = await tx.vendedor.upsert({
      where: { idExternoErp },
      update: {},
      create: { idExternoErp, incompleto: true, sincronizadoEm: new Date() },
    });

    if (vendedor.incompleto) {
      this.logger.warn(
        `Vendedor ${idExternoErp} ainda nao sincronizado - stub criado/reaproveitado para o cliente referenciar`,
      );
    }

    return vendedor.id;
  }
}

// Tipo do client de transacao do Prisma (this.prisma.$transaction(tx => ...))
type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

// WK Radar aceita date-time sem milissegundos/timezone (ex:
// "2026-08-17T00:00:00") - confirmado contra o ambiente de testes.
function formatarDataWkRadar(data: Date): string {
  return data.toISOString().replace(/\.\d{3}Z$/, '');
}
