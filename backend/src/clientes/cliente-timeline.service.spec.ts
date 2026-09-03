import { NotFoundException } from '@nestjs/common';
import { ClienteTimelineService } from './cliente-timeline.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function decimalFake(valor: number) {
  return { toString: () => String(valor) };
}

function prismaFake(overrides: {
  cliente?: Record<string, unknown> | null;
  pedidos?: Record<string, unknown>[];
  historicoStatus?: Record<string, unknown>[];
  visitas?: Record<string, unknown>[];
  notasFiscais?: Record<string, unknown>[];
}) {
  return {
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides.cliente === undefined ? { id: 'c1' } : overrides.cliente),
    },
    pedido: {
      findMany: jest.fn().mockResolvedValue(overrides.pedidos ?? []),
    },
    pedidoHistoricoStatus: {
      findMany: jest.fn().mockResolvedValue(overrides.historicoStatus ?? []),
    },
    visita: {
      findMany: jest.fn().mockResolvedValue(overrides.visitas ?? []),
    },
    notaFiscal: {
      findMany: jest.fn().mockResolvedValue(overrides.notasFiscais ?? []),
    },
  };
}

describe('ClienteTimelineService.obterTimeline', () => {
  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const service = new ClienteTimelineService(prismaFake({ cliente: null }) as never);

    await expect(service.obterTimeline('inexistente', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar nada quando o escopo e NENHUM', async () => {
    const prisma = prismaFake({});
    const service = new ClienteTimelineService(prisma as never);

    await expect(service.obterTimeline('c1', { tipo: 'NENHUM' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('combina pedido, mudanca de status, visita (checkin/checkout) e nota fiscal, ordenados do mais recente pro mais antigo', async () => {
    const prisma = prismaFake({
      pedidos: [
        {
          id: 'p1',
          numero: '100',
          situacao: 'FATURADO',
          valorTotal: decimalFake(500),
          dataHoraUltimaAlteracao: new Date('2026-01-10T00:00:00.000Z'),
        },
      ],
      historicoStatus: [
        {
          pedidoId: 'p1',
          statusAnterior: 'PENDENTE',
          statusNovo: 'FATURADO',
          alteradoEm: new Date('2026-01-05T00:00:00.000Z'),
        },
      ],
      visitas: [
        {
          id: 'v1',
          checkinEm: new Date('2026-01-03T00:00:00.000Z'),
          checkoutEm: new Date('2026-01-03T01:00:00.000Z'),
          canceladaEm: null,
          motivoCancelamento: null,
        },
      ],
      notasFiscais: [
        {
          id: 'nf1',
          numero: '999',
          statusNfe: 'AUTORIZADA',
          dataEmissao: new Date('2026-01-11T00:00:00.000Z'),
        },
      ],
    });
    const service = new ClienteTimelineService(prisma as never);

    const eventos = await service.obterTimeline('c1', ESCOPO_TODOS);

    expect(eventos.map((e) => e.tipo)).toEqual([
      'NOTA_FISCAL',
      'PEDIDO',
      'PEDIDO_STATUS_ALTERADO',
      'VISITA_CHECKOUT',
      'VISITA_CHECKIN',
    ]);
    // ordem estritamente decrescente por data
    for (let i = 1; i < eventos.length; i++) {
      expect(eventos[i - 1].data >= eventos[i].data).toBe(true);
    }
  });

  it('visita cancelada emite VISITA_CHECKIN + VISITA_CANCELADA, nunca VISITA_CHECKOUT', async () => {
    const prisma = prismaFake({
      visitas: [
        {
          id: 'v1',
          checkinEm: new Date('2026-01-03T00:00:00.000Z'),
          checkoutEm: null,
          canceladaEm: new Date('2026-01-03T00:10:00.000Z'),
          motivoCancelamento: 'Cliente ausente',
        },
      ],
    });
    const service = new ClienteTimelineService(prisma as never);

    const eventos = await service.obterTimeline('c1', ESCOPO_TODOS);

    expect(eventos.map((e) => e.tipo)).toEqual(['VISITA_CANCELADA', 'VISITA_CHECKIN']);
  });

  it('retorna lista vazia quando o cliente nao tem nenhum evento', async () => {
    const prisma = prismaFake({});
    const service = new ClienteTimelineService(prisma as never);

    const eventos = await service.obterTimeline('c1', ESCOPO_TODOS);

    expect(eventos).toEqual([]);
  });
});
