import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceiroSvcClientService } from '../financeiro-svc-client/financeiro-svc-client.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';

export interface BoletoArquivoDto {
  buffer: Buffer;
  nomeArquivo: string;
}

// GET /clientes/:id/titulos/:numeroDocumento/boleto (OS-BACKEND-43) -
// aninhado sob /clientes/:id (nao /titulos/:id solto como o texto original
// da OS sugeria) pra reaproveitar o MESMO escopo por vendedor de todo
// outro endpoint de cliente (VendedorEscopoService) - um numeroDocumento
// sozinho seria adivinhavel (IDOR, ver skill security-review), precisa
// confirmar que o titulo pertence a um cliente dentro do escopo de quem
// pede antes de buscar o boleto. Nunca persiste o PDF - busca sob demanda
// a cada solicitacao (mesmo criterio de ClienteFinanceiroService: dado
// transacional, nunca cópia desatualizada).
@Injectable()
export class ClienteBoletoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiroSvcClient: FinanceiroSvcClientService,
  ) {}

  async obter(
    clienteId: string,
    escopo: EscopoClientes,
    numeroDocumento: string,
  ): Promise<BoletoArquivoDto> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, ...whereEscopo },
      select: { idExternoErp: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const tokens = await this.financeiroSvcClient.buscarTokenBoleto({
      CodigoClienteSacado: cliente.idExternoErp,
      NumeroDocumento: numeroDocumento,
    });
    const [token] = tokens;
    if (!token) {
      throw new NotFoundException(
        `Boleto do documento '${numeroDocumento}' não encontrado para este cliente`,
      );
    }

    const buffer = await this.financeiroSvcClient.downloadBoleto(token);
    if (!buffer) {
      throw new NotFoundException(
        `Boleto do documento '${numeroDocumento}' não pôde ser baixado`,
      );
    }

    return { buffer, nomeArquivo: `boleto-${numeroDocumento}.pdf` };
  }
}
