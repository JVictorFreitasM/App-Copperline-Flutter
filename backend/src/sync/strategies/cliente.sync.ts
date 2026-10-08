import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { CredenciaisErpService } from '../../credenciais-erp/credenciais-erp.service';
import { ErpClientService } from '../../erp-client/erp-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { buscarPorJanelas } from '../paginacao-por-janela';
import type {
  SyncFetchResultado,
  SyncStrategy,
  SyncWindow,
} from '../sync-strategy.interface';
import type {
  ClienteMapeado,
  ContatoMapeado,
  WkRadarCliente,
} from './cliente.types';

// ErpClientService.baseUrl ja inclui {host}/wk.api/api (ver skill
// wk-radar-client, secao "Base de URL") - aqui so o sufixo do recurso.
const ROTA_CLIENTE = '/empresarial/v1/cliente';

const CAMPOS_CLIENTE = [
  'id',
  'codigo',
  'codigoIntegrador',
  'email',
  'contato',
  'homepage',
  'cpfCnpj',
  'razaoSocial',
  'nomeFantasia',
  'inativo',
  'enderecos',
  'inscricoesLegais.inscricaoEstadual',
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
  'informacoesExtras2.idTabelaPrecoProduto',
];

const TAMANHO_JANELA_PADRAO_MS = 24 * 60 * 60 * 1000; // 1 dia

@Injectable()
export class ClienteSyncStrategy implements SyncStrategy<
  WkRadarCliente,
  ClienteMapeado
> {
  readonly nomeEntidade = 'cliente';
  private readonly logger = new Logger(ClienteSyncStrategy.name);

  constructor(
    private readonly erpClient: ErpClientService,
    private readonly prisma: PrismaService,
    private readonly configService: CredenciaisErpService,
  ) {}

  // Lido a cada busca (editavel no painel em Configuracoes > Integracao ERP, sem reiniciar).
  private get tamanhoJanelaMs(): number {
    return Number(this.configService.get('WK_RADAR_JANELA_CLIENTE_MS') ?? TAMANHO_JANELA_PADRAO_MS);
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
      codigo: bruto.codigo ?? null,
      codigoIntegrador: bruto.codigoIntegrador ?? null,
      email: bruto.email || null,
      contato: bruto.contato || null,
      homepage: bruto.homepage || null,
      cpfCnpj: bruto.cpfCnpj ?? null,
      razaoSocial: bruto.razaoSocial ?? null,
      nomeFantasia: bruto.nomeFantasia ?? null,
      inscricaoEstadual: bruto.inscricoesLegais?.inscricaoEstadual ?? null,
      inativo: bruto.inativo,
      enderecos: bruto.enderecos ?? [],
      contatos: [
        ...contatosDoRadar(bruto),
        ...contatosDosTelefonesDeEndereco(bruto),
      ],
      vendedoresExternoIds: bruto.detalhes?.idVendedores ?? [],
      limiteCredito: bruto.informacoesFinanceiras?.limiteCredito ?? null,
      dataLimiteCredito: bruto.informacoesFinanceiras?.dataLimiteCredito
        ? new Date(bruto.informacoesFinanceiras.dataLimiteCredito)
        : null,
      tabelaPrecoIdExterno: bruto.informacoesExtras2?.idTabelaPrecoProduto ?? null,
    };
  }

  async upsert(mapeado: ClienteMapeado): Promise<void> {
    const sincronizadoEm = new Date();
    const enderecos = mapeado.enderecos as unknown as Prisma.InputJsonValue;

    await this.prisma.$transaction(async (tx) => {
      // Cliente cadastrado por nos (POST /clientes) e enviado ao Radar: o
      // codigoIntegrador que mandamos e' o id LOCAL. Troca o id sintetico
      // ("PENDENTE-<uuid>") pelo real ANTES do upsert - senao o upsert criaria
      // uma segunda linha pro mesmo cliente.
      if (mapeado.codigoIntegrador) {
        await tx.cliente.updateMany({
          where: {
            id: mapeado.codigoIntegrador,
            criadoLocalmente: true,
            idExternoErp: { startsWith: 'PENDENTE-' },
          },
          data: { idExternoErp: mapeado.idExternoErp },
        });
      }

      const cliente = await tx.cliente.upsert({
        where: { idExternoErp: mapeado.idExternoErp },
        create: {
          idExternoErp: mapeado.idExternoErp,
          codigo: mapeado.codigo,
          email: mapeado.email,
          contato: mapeado.contato,
          homepage: mapeado.homepage,
          codigoIntegrador: mapeado.codigoIntegrador,
          cpfCnpj: mapeado.cpfCnpj,
          razaoSocial: mapeado.razaoSocial,
          nomeFantasia: mapeado.nomeFantasia,
          inscricaoEstadual: mapeado.inscricaoEstadual,
          inativo: mapeado.inativo,
          enderecos,
          incompleto: false,
          sincronizadoEm,
          limiteCredito: mapeado.limiteCredito,
          dataLimiteCredito: mapeado.dataLimiteCredito,
          tabelaPrecoIdExterno: mapeado.tabelaPrecoIdExterno,
        },
        // incompleto:false tambem no update - "completa" um eventual stub
        // criado por PedidoSyncStrategy (OS 07) quando o cliente de verdade
        // chega aqui.
        update: {
          codigo: mapeado.codigo,
          email: mapeado.email,
          contato: mapeado.contato,
          homepage: mapeado.homepage,
          codigoIntegrador: mapeado.codigoIntegrador,
          cpfCnpj: mapeado.cpfCnpj,
          razaoSocial: mapeado.razaoSocial,
          nomeFantasia: mapeado.nomeFantasia,
          inscricaoEstadual: mapeado.inscricaoEstadual,
          inativo: mapeado.inativo,
          enderecos,
          incompleto: false,
          sincronizadoEm,
          limiteCredito: mapeado.limiteCredito,
          dataLimiteCredito: mapeado.dataLimiteCredito,
          tabelaPrecoIdExterno: mapeado.tabelaPrecoIdExterno,
        },
      });

      // Chegou do Radar = ele ja tem o cliente. Fecha o ciclo do envio e tira
      // os contatos que criamos localmente (o Radar devolve os mesmos com id
      // proprio - ficariam duplicados). Contato ligado a pedido fica.
      await tx.cliente.updateMany({
        where: { id: cliente.id, criadoLocalmente: true },
        data: { statusEnvioErp: 'ENVIADO', erroEnvioErp: null },
      });
      if (cliente.criadoLocalmente && mapeado.contatos.length > 0) {
        await tx.contatoCliente.deleteMany({
          where: {
            clienteId: cliente.id,
            criadoLocalmente: true,
            pedidos: { none: {} },
          },
        });
      }

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

function contatosDoRadar(bruto: WkRadarCliente): ContatoMapeado[] {
  return (bruto.contatos ?? []).map((contato) => ({
    idExternoErp: contato.id,
    codigoIntegrador: contato.codigoIntegrador ?? null,
    nome: contato.nome ?? null,
    email: contato.email ?? null,
    telefoneDdd: contato.telefoneDDD ?? null,
    telefoneNumero: contato.telefoneNumero ?? null,
    funcao: contato.funcao ?? null,
  }));
}

// Telefones cadastrados no ENDERECO do cliente (enderecos[].telefones) nao
// sao "contatos" no Radar (sem id proprio), mas o vendedor precisa escolhe-los
// na lista de contatos da criacao do pedido - e contatoId do pedido e' FK pra
// ContatoCliente, entao viram linhas aqui. idExternoErp sintetico e
// deterministico ("ENDERECO-<cliente>-<ddd><numero>", mesmo criterio do
// prefixo "LOCAL-") pra o upsert ser idempotente; nunca sobe pro Radar.
// Telefone que ja existe como contato de verdade do Radar nao e' duplicado.
function contatosDosTelefonesDeEndereco(bruto: WkRadarCliente): ContatoMapeado[] {
  const chave = (ddd: string | null | undefined, numero: string) =>
    `${(ddd ?? '').replace(/\D/g, '').replace(/^0+/, '')}${numero.replace(/\D/g, '')}`;
  const jaExistentes = new Set(
    (bruto.contatos ?? [])
      .filter((contato) => contato.telefoneNumero)
      .map((contato) => chave(contato.telefoneDDD, contato.telefoneNumero as string)),
  );

  const contatos: ContatoMapeado[] = [];
  for (const endereco of bruto.enderecos ?? []) {
    for (const telefone of endereco.telefones ?? []) {
      if (!telefone.numero) continue;
      const identificador = chave(telefone.ddd, telefone.numero);
      if (jaExistentes.has(identificador)) continue;
      jaExistentes.add(identificador);

      contatos.push({
        idExternoErp: `ENDERECO-${bruto.id}-${identificador}`,
        codigoIntegrador: null,
        // Telefone no nome: a lista de contatos do pedido so mostra o nome, e
        // dois telefones do mesmo cliente ficariam indistinguiveis.
        nome: `${bruto.nomeFantasia || bruto.razaoSocial || 'Telefone'} - ${
          telefone.ddd ? `(${telefone.ddd}) ` : ''
        }${telefone.numero}`,
        email: endereco.email || null,
        telefoneDdd: telefone.ddd || null,
        telefoneNumero: telefone.numero,
        funcao: 'Telefone do endereço',
      });
    }
  }
  return contatos;
}

// Tipo do client de transacao do Prisma (this.prisma.$transaction(tx => ...))
type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

// WK Radar aceita date-time sem milissegundos/timezone (ex:
// "2026-08-17T00:00:00") - confirmado contra o ambiente de testes.
function formatarDataWkRadar(data: Date): string {
  return data.toISOString().replace(/\.\d{3}Z$/, '');
}
