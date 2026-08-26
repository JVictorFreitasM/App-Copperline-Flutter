import { FilaPendenteService } from './fila-pendente.service';
import type { AcaoFilaDto } from './dto/fila-pendente.dto';
import type { IdpUser } from '@copperline/idp-client';

const IDP_USER: IdpUser = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

function prismaFake(overrides: { jaProcessada?: Record<string, unknown> | null } = {}) {
  const registros = new Map<string, Record<string, unknown>>();
  return {
    acaoFilaProcessada: {
      findUnique: jest.fn().mockImplementation(async () => {
        if ('jaProcessada' in overrides) return overrides.jaProcessada;
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        registros.set(data.idLocal as string, data);
        return data;
      }),
    },
    _registros: registros,
  };
}

function criarPedidoServiceFake() {
  return { criar: jest.fn().mockResolvedValue({ status: 'ENVIADO', pedidoId: 'pedido-1' }) };
}
function visitasServiceFake() {
  return {
    checkin: jest.fn().mockResolvedValue({ id: 'visita-1' }),
    checkout: jest.fn().mockResolvedValue({ id: 'visita-1', checkoutEm: '2026-01-01T00:00:00.000Z' }),
    cancelar: jest.fn().mockResolvedValue({ id: 'visita-1', canceladaEm: '2026-01-01T00:00:00.000Z' }),
  };
}
function rastreioServiceFake() {
  return { registrarLote: jest.fn().mockResolvedValue({ loteId: 'lote-1', quantidade: 2 }) };
}
function vendedorEscopoServiceFake() {
  return { resolverEscopoClientes: jest.fn().mockResolvedValue({ tipo: 'TODOS' }) };
}

function acao(overrides: Partial<AcaoFilaDto> = {}): AcaoFilaDto {
  return {
    idLocal: 'acao-1',
    tipo: 'RASTREIO_LOTE',
    timestamp: '2026-01-01T10:00:00.000Z',
    payload: { pontos: [{ latitude: 0, longitude: 0, timestamp: '2026-01-01T10:00:00.000Z' }] },
    ...overrides,
  };
}

function montarService(prisma: ReturnType<typeof prismaFake>) {
  return new FilaPendenteService(
    prisma as never,
    criarPedidoServiceFake() as never,
    visitasServiceFake() as never,
    rastreioServiceFake() as never,
    vendedorEscopoServiceFake() as never,
  );
}

describe('FilaPendenteService.processar - idempotencia', () => {
  it('reenviar o mesmo idLocal devolve o resultado ja gravado, sem re-executar (criterio de aceite)', async () => {
    const prisma = prismaFake({
      jaProcessada: {
        status: 'SUCESSO',
        resultado: { loteId: 'lote-1', quantidade: 2 },
        erro: null,
      },
    });
    const rastreioService = rastreioServiceFake();
    const service = new FilaPendenteService(
      prisma as never,
      criarPedidoServiceFake() as never,
      visitasServiceFake() as never,
      rastreioService as never,
      vendedorEscopoServiceFake() as never,
    );

    const resultado = await service.processar('u1', IDP_USER, [acao()]);

    expect(rastreioService.registrarLote).not.toHaveBeenCalled();
    expect(prisma.acaoFilaProcessada.create).not.toHaveBeenCalled();
    expect(resultado).toEqual([
      { idLocal: 'acao-1', status: 'SUCESSO', resultado: { loteId: 'lote-1', quantidade: 2 }, erro: undefined },
    ]);
  });

  it('grava o resultado apos executar com sucesso pela primeira vez', async () => {
    const prisma = prismaFake();
    const service = montarService(prisma);

    const resultado = await service.processar('u1', IDP_USER, [acao()]);

    expect(prisma.acaoFilaProcessada.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idLocal: 'acao-1', status: 'SUCESSO' }),
      }),
    );
    expect(resultado[0].status).toBe('SUCESSO');
  });
});

describe('FilaPendenteService.processar - status individual por item', () => {
  it('retorna status individual (sucesso e erro misturados no mesmo lote)', async () => {
    const prisma = prismaFake();
    const service = montarService(prisma);

    const resultado = await service.processar('u1', IDP_USER, [
      acao({ idLocal: 'acao-ok', tipo: 'RASTREIO_LOTE' }),
      acao({
        idLocal: 'acao-erro',
        tipo: 'CHECKOUT_VISITA',
        payload: { visitaId: 'nao-e-uuid', latitude: 0, longitude: 0 },
      }),
    ]);

    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toMatchObject({ idLocal: 'acao-ok', status: 'SUCESSO' });
    expect(resultado[1]).toMatchObject({ idLocal: 'acao-erro', status: 'ERRO' });
  });

  it('processa as acoes NA ORDEM recebida (sequencial, nao paralelo)', async () => {
    const prisma = prismaFake();
    const ordem: string[] = [];
    const rastreioService = {
      registrarLote: jest.fn().mockImplementation(async () => {
        ordem.push('primeira');
        return {};
      }),
    };
    const visitasService = {
      ...visitasServiceFake(),
      checkout: jest.fn().mockImplementation(async () => {
        ordem.push('segunda');
        return {};
      }),
    };
    const service = new FilaPendenteService(
      prisma as never,
      criarPedidoServiceFake() as never,
      visitasService as never,
      rastreioService as never,
      vendedorEscopoServiceFake() as never,
    );

    await service.processar('u1', IDP_USER, [
      acao({ idLocal: 'a1', tipo: 'RASTREIO_LOTE' }),
      acao({
        idLocal: 'a2',
        tipo: 'CHECKOUT_VISITA',
        payload: { visitaId: '11111111-1111-4111-8111-111111111111', latitude: 0, longitude: 0 },
      }),
    ]);

    expect(ordem).toEqual(['primeira', 'segunda']);
  });
});

describe('FilaPendenteService.processar - despacha pro service correto por tipo', () => {
  it('CRIAR_PEDIDO chama CriarPedidoService.criar com o escopo resolvido', async () => {
    const prisma = prismaFake();
    const criarPedidoService = criarPedidoServiceFake();
    const vendedorEscopoService = vendedorEscopoServiceFake();
    const service = new FilaPendenteService(
      prisma as never,
      criarPedidoService as never,
      visitasServiceFake() as never,
      rastreioServiceFake() as never,
      vendedorEscopoService as never,
    );

    await service.processar('u1', IDP_USER, [
      acao({
        tipo: 'CRIAR_PEDIDO',
        payload: {
          clienteId: '11111111-1111-4111-8111-111111111111',
          percentualDesconto: 10,
          itens: [{ produtoId: '22222222-2222-4222-8222-222222222222', metrosDesejados: 90 }],
        },
      }),
    ]);

    expect(vendedorEscopoService.resolverEscopoClientes).toHaveBeenCalledWith(IDP_USER, 'u1');
    expect(criarPedidoService.criar).toHaveBeenCalledWith(
      expect.objectContaining({ percentualDesconto: 10 }),
      'u1',
      { tipo: 'TODOS' },
    );
  });

  it('CHECKIN_VISITA decodifica a foto base64 e usa o timestamp da acao como momento do check-in', async () => {
    const prisma = prismaFake();
    const visitasService = visitasServiceFake();
    const service = new FilaPendenteService(
      prisma as never,
      criarPedidoServiceFake() as never,
      visitasService as never,
      rastreioServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );
    const fotoBase64 = Buffer.from('foto-fake').toString('base64');

    await service.processar('u1', IDP_USER, [
      acao({
        tipo: 'CHECKIN_VISITA',
        timestamp: '2026-01-01T08:00:00.000Z',
        payload: {
          clienteId: '11111111-1111-4111-8111-111111111111',
          latitude: -23.5,
          longitude: -46.6,
          foto: fotoBase64,
        },
      }),
    ]);

    expect(visitasService.checkin).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ clienteId: '11111111-1111-4111-8111-111111111111' }),
      Buffer.from('foto-fake'),
      new Date('2026-01-01T08:00:00.000Z'),
    );
  });

  it('RASTREIO_LOTE chama RastreioService.registrarLote com os pontos do payload', async () => {
    const prisma = prismaFake();
    const rastreioService = rastreioServiceFake();
    const service = new FilaPendenteService(
      prisma as never,
      criarPedidoServiceFake() as never,
      visitasServiceFake() as never,
      rastreioService as never,
      vendedorEscopoServiceFake() as never,
    );

    await service.processar('u1', IDP_USER, [
      acao({
        payload: {
          pontos: [
            { latitude: 1, longitude: 2, timestamp: '2026-01-01T09:00:00.000Z' },
          ],
        },
      }),
    ]);

    expect(rastreioService.registrarLote).toHaveBeenCalledWith('u1', [
      { latitude: 1, longitude: 2, timestamp: '2026-01-01T09:00:00.000Z' },
    ]);
  });

  it('CANCELAR_VISITA chama VisitasService.cancelar com o comentario e o momento da acao', async () => {
    const prisma = prismaFake();
    const visitasService = visitasServiceFake();
    const service = new FilaPendenteService(
      prisma as never,
      criarPedidoServiceFake() as never,
      visitasService as never,
      rastreioServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );

    await service.processar('u1', IDP_USER, [
      acao({
        tipo: 'CANCELAR_VISITA',
        timestamp: '2026-01-01T08:30:00.000Z',
        payload: {
          visitaId: '11111111-1111-4111-8111-111111111111',
          comentario: 'errei o cliente',
        },
      }),
    ]);

    expect(visitasService.cancelar).toHaveBeenCalledWith(
      'u1',
      '11111111-1111-4111-8111-111111111111',
      'errei o cliente',
      new Date('2026-01-01T08:30:00.000Z'),
    );
  });
});
