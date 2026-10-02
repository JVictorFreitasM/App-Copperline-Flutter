import { ForbiddenException, Injectable } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import {
  paraClienteDetalheDto,
  type ClienteDetalheDto,
} from '../clientes/dto/cliente-response.dto';
import { ConfiguracaoOrcamentoService } from '../configuracoes/configuracao-orcamento.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  VendedorEscopoService,
} from '../vendedores/vendedor-escopo.service';

// Item de tabela de preco no formato compacto [codigoItem (codigo do
// produto), preco] - 12 mil linhas no total, o JSON enxuto importa.
export type ItemPrecoCompacto = [string, string];

export interface TabelaPrecoOfflineDto {
  codigo: string;
  itens: ItemPrecoCompacto[];
}

export interface DadosComerciaisMobileDto {
  geradoEm: string;
  // Carteira COMPLETA do vendedor (mesmo escopo de GET /clientes), ja com
  // contatos/enderecos - o app mostra o detalhe do cliente sem rede.
  clientes: ClienteDetalheDto[];
  // Tabelas de preco com os precos por produto, pra ver offline o preco de
  // cada produto na tabela do cliente.
  tabelasPreco: TabelaPrecoOfflineDto[];
  // clienteId -> codigos das tabelas do cliente (mesma regra de
  // ClienteTabelaPrecoService.listarPorCliente: associacao manual do admin;
  // sem nenhuma, a tabela nativa do cadastro do Radar).
  tabelasPorCliente: Record<string, string[]>;
  // Regra de pedido que o app valida ANTES de enviar (inclusive offline):
  // false = o mesmo produto nao pode aparecer duas vezes no mesmo pedido
  // (ConfiguracaoOrcamento.permitirItensRepetidos; o backend rejeita igual).
  permitirItensRepetidos: boolean;
}

// Teto de seguranca, mesmo valor de MobileSnapshotService.
const LIMITE_CLIENTES = 5000;

// Complemento do snapshot offline (GET /mobile/snapshot so' traz o RESUMO
// dos clientes e o preco da tabela padrao): carteira com detalhe + tabelas
// de preco por cliente. Endpoint proprio pra nao inflar o snapshot base e
// poder ser baixado/atualizado separadamente.
@Injectable()
export class MobileDadosComerciaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendedorEscopoService: VendedorEscopoService,
    private readonly configuracaoOrcamentoService: ConfiguracaoOrcamentoService,
  ) {}

  async obter(idpUser: IdpUser, usuarioId: string): Promise<DadosComerciaisMobileDto> {
    const vendedor = await this.prisma.vendedor.findFirst({ where: { usuarioId } });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado - sem dados offline para gerar',
      );
    }

    const escopo = await this.vendedorEscopoService.resolverEscopoClientes(idpUser, usuarioId);
    const whereClientes = construirWhereClientePorEscopo(escopo);

    const clientes = whereClientes
      ? await this.prisma.cliente.findMany({
          where: whereClientes,
          take: LIMITE_CLIENTES,
          orderBy: { razaoSocial: 'asc' },
          include: { contatos: true },
        })
      : [];

    const clienteIds = clientes.map((cliente) => cliente.id);
    const [associacoes, tabelas] = await Promise.all([
      this.prisma.clienteTabelaPreco.findMany({
        where: { clienteId: { in: clienteIds } },
        select: { clienteId: true, codigo: true },
        orderBy: { criadoEm: 'asc' },
      }),
      this.prisma.tabelaPreco.findMany({
        select: { id: true, codigo: true, idExternoErp: true },
      }),
    ]);

    const codigoPorIdExterno = new Map(tabelas.map((t) => [t.idExternoErp, t.codigo]));
    const manuaisPorCliente = new Map<string, string[]>();
    for (const associacao of associacoes) {
      const lista = manuaisPorCliente.get(associacao.clienteId) ?? [];
      lista.push(associacao.codigo);
      manuaisPorCliente.set(associacao.clienteId, lista);
    }

    const tabelasPorCliente: Record<string, string[]> = {};
    for (const cliente of clientes) {
      const manuais = manuaisPorCliente.get(cliente.id);
      if (manuais && manuais.length > 0) {
        tabelasPorCliente[cliente.id] = manuais;
        continue;
      }
      const nativa = cliente.tabelaPrecoIdExterno
        ? codigoPorIdExterno.get(cliente.tabelaPrecoIdExterno)
        : undefined;
      tabelasPorCliente[cliente.id] = nativa ? [nativa] : [];
    }

    const itens = await this.prisma.itemTabelaPreco.findMany({
      select: { tabelaPrecoId: true, codigoItem: true, preco: true },
    });
    const itensPorTabela = new Map<string, ItemPrecoCompacto[]>();
    for (const item of itens) {
      const lista = itensPorTabela.get(item.tabelaPrecoId) ?? [];
      lista.push([item.codigoItem, item.preco.toString()]);
      itensPorTabela.set(item.tabelaPrecoId, lista);
    }

    const { permitirItensRepetidos } = await this.configuracaoOrcamentoService.obter();

    return {
      geradoEm: new Date().toISOString(),
      permitirItensRepetidos,
      clientes: clientes.map(paraClienteDetalheDto),
      tabelasPreco: tabelas.map((tabela) => ({
        codigo: tabela.codigo,
        itens: itensPorTabela.get(tabela.id) ?? [],
      })),
      tabelasPorCliente,
    };
  }
}
