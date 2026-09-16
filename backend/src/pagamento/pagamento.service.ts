import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraCondicaoPagamentoDto,
  paraFormaPagamentoDto,
  type CondicaoPagamentoDto,
  type FormaPagamentoDto,
} from './dto/pagamento-response.dto';

// Leitura dos catalogos sincronizados de forma/condicao de pagamento (ver
// sync/strategies/forma-pagamento.sync.ts e condicao-pagamento.sync.ts) -
// preparacao pro envio de pedido ao ERP (ver OS-pendentes-claude-code.md).
// Filtro de "so o que pode ser usado agora" fica aqui (service de leitura),
// nao na sync - mesmo criterio ja documentado nos comentarios do schema.
@Injectable()
export class PagamentoService {
  constructor(private readonly prisma: PrismaService) {}

  // So as ativas (inativa=false) - decisao confirmada com o usuario: quem
  // cria pedido nunca deve poder escolher uma forma desativada no Radar.
  async listarFormasPagamento(): Promise<FormaPagamentoDto[]> {
    const formas = await this.prisma.formaPagamento.findMany({
      where: { inativa: false },
      orderBy: { descricao: 'asc' },
    });
    return formas.map(paraFormaPagamentoDto);
  }

  // So as ainda vigentes: sem data de validade, ou validade >= hoje. O
  // endpoint do Radar nao tem flag de "ativa" (ver condicao-pagamento.sync.ts)
  // - `validade` e' o unico sinal, comparado aqui no momento da leitura (nao
  // gravado como um booleano derivado, que ficaria desatualizado entre syncs).
  async listarCondicoesPagamento(): Promise<CondicaoPagamentoDto[]> {
    const hoje = new Date();
    const condicoes = await this.prisma.condicaoPagamento.findMany({
      where: { OR: [{ validade: null }, { validade: { gte: hoje } }] },
      orderBy: { nome: 'asc' },
    });
    return condicoes.map(paraCondicaoPagamentoDto);
  }
}
