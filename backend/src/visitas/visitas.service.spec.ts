import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import exifr from 'exifr';
import { VisitasService } from './visitas.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

jest.mock('exifr', () => ({
  __esModule: true,
  default: { parse: jest.fn() },
}));

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };
const FOTO_BUFFER = Buffer.from('foto-fake');

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function visitaBruta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'visita-1',
    clienteId: 'cliente-1',
    vendedorId: 'vendedor-1',
    checkinEm: new Date('2026-01-01T10:00:00.000Z'),
    checkinLat: decimalFake(-23.5505),
    checkinLng: decimalFake(-46.6333),
    checkoutEm: null,
    checkoutLat: null,
    checkoutLng: null,
    nota: null,
    canceladaEm: null,
    motivoCancelamento: null,
    fotoCheckinCaminho: '/uploads/visitas/foto.jpg',
    distanciaCheckinMetros: decimalFake(10),
    distanciaCheckoutMetros: null,
    ...overrides,
  };
}

// Cliente com pin bem perto das coordenadas usadas nos testes (mesma
// posicao, distancia ~0m) - salvo quando o teste sobrescreve.
function clienteBruto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cliente-1',
    localizacaoLat: decimalFake(-23.5505),
    localizacaoLng: decimalFake(-46.6333),
    ...overrides,
  };
}

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  cliente?: Record<string, unknown> | null;
  visitaAberta?: Record<string, unknown> | null;
  visitaExistente?: Record<string, unknown> | null;
  visitasDoCliente?: Record<string, unknown>[];
} = {}) {
  const tx = {
    visita: { update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => visitaBruta(data)) },
    eventoNotificacao: { create: jest.fn().mockResolvedValue(undefined) },
  };

  return {
    vendedor: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'vendedor' in overrides ? overrides.vendedor : { id: 'vendedor-1', nome: 'Fulano' },
        ),
    },
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue('cliente' in overrides ? overrides.cliente : clienteBruto()),
    },
    visita: {
      findFirst: jest
        .fn()
        .mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
          'checkoutEm' in where
            ? ('visitaAberta' in overrides ? overrides.visitaAberta : null)
            : ('visitaExistente' in overrides ? overrides.visitaExistente : visitaBruta()),
        ),
      findUnique: jest.fn().mockResolvedValue(visitaBruta()),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        visitaBruta({
          ...data,
          checkinLat: decimalFake(data.checkinLat as number),
          checkinLng: decimalFake(data.checkinLng as number),
          distanciaCheckinMetros: decimalFake(data.distanciaCheckinMetros as number),
        }),
      ),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        visitaBruta({
          ...(data.checkoutEm !== undefined && {
            checkoutEm: data.checkoutEm,
            checkoutLat: decimalFake(data.checkoutLat as number),
            checkoutLng: decimalFake(data.checkoutLng as number),
            distanciaCheckoutMetros: decimalFake(data.distanciaCheckoutMetros as number),
          }),
          ...(data.nota !== undefined && { nota: data.nota }),
        }),
      ),
      findMany: jest.fn().mockResolvedValue(overrides.visitasDoCliente ?? [visitaBruta()]),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    _tx: tx,
  };
}

function fotoStorageFake() {
  return {
    salvar: jest.fn().mockResolvedValue('/uploads/visitas/foto.jpg'),
    ler: jest.fn().mockResolvedValue(FOTO_BUFFER),
  };
}

const exifrMock = exifr as unknown as { parse: jest.Mock };

beforeEach(() => {
  exifrMock.parse.mockReset();
  exifrMock.parse.mockResolvedValue({ DateTimeOriginal: new Date() });
});

describe('VisitasService.checkin', () => {
  it('lanca ForbiddenException quando o usuario nao e um vendedor cadastrado', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkin('u1', { clienteId: 'c1', latitude: 0, longitude: 0 }, FOTO_BUFFER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanca NotFoundException quando o cliente nao pertence ao vendedor', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkin('u1', { clienteId: 'c1', latitude: 0, longitude: 0 }, FOTO_BUFFER),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanca UnprocessableEntityException quando o cliente nao tem pin de localizacao definido', async () => {
    const prisma = prismaFake({
      cliente: clienteBruto({ localizacaoLat: null, localizacaoLng: null }),
    });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkin(
        'u1',
        { clienteId: 'cliente-1', latitude: -23.5505, longitude: -46.6333 },
        FOTO_BUFFER,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('lanca BadRequestException quando o check-in esta fora do raio de 50m do pin', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    // ~0.01 grau de diferenca ja e' mais de 1km - bem fora do raio.
    await expect(
      service.checkin(
        'u1',
        { clienteId: 'cliente-1', latitude: -23.56, longitude: -46.6333 },
        FOTO_BUFFER,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('bloqueia com ConflictException quando ja existe visita aberta (nao cancelada) do vendedor', async () => {
    const prisma = prismaFake({
      visitaAberta: { id: 'visita-aberta', clienteId: 'outro-cliente' },
    });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkin(
        'u1',
        { clienteId: 'cliente-1', latitude: -23.5505, longitude: -46.6333 },
        FOTO_BUFFER,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.visita.create).not.toHaveBeenCalled();
  });

  it('lanca BadRequestException quando a foto esta vazia', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkin(
        'u1',
        { clienteId: 'cliente-1', latitude: -23.5505, longitude: -46.6333 },
        Buffer.alloc(0),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanca BadRequestException quando a foto nao tem EXIF de data/hora (anti-fraude)', async () => {
    exifrMock.parse.mockResolvedValue({});
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkin(
        'u1',
        { clienteId: 'cliente-1', latitude: -23.5505, longitude: -46.6333 },
        FOTO_BUFFER,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanca BadRequestException quando a data EXIF da foto diverge do check-in', async () => {
    exifrMock.parse.mockResolvedValue({ DateTimeOriginal: new Date('2020-01-01T00:00:00.000Z') });
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkin(
        'u1',
        { clienteId: 'cliente-1', latitude: -23.5505, longitude: -46.6333 },
        FOTO_BUFFER,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('cria a visita, salva a foto e grava a distancia calculada quando tudo e valido', async () => {
    const prisma = prismaFake();
    const fotoStorage = fotoStorageFake();
    const service = new VisitasService(prisma as never, fotoStorage as never);

    const resultado = await service.checkin(
      'u1',
      { clienteId: 'cliente-1', latitude: -23.5505, longitude: -46.6333, nota: 'ok' },
      FOTO_BUFFER,
    );

    expect(fotoStorage.salvar).toHaveBeenCalledWith(FOTO_BUFFER);
    expect(prisma.visita.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clienteId: 'cliente-1',
          vendedorId: 'vendedor-1',
          fotoCheckinCaminho: '/uploads/visitas/foto.jpg',
          nota: 'ok',
        }),
      }),
    );
    expect(resultado.temFoto).toBe(true);
    expect(resultado.checkoutEm).toBeNull();
  });
});

describe('VisitasService.checkout', () => {
  it('lanca NotFoundException quando a visita nao existe ou nao pertence ao vendedor', async () => {
    const prisma = prismaFake({ visitaExistente: null });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkout('u1', 'visita-1', { latitude: -23.5505, longitude: -46.6333 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanca ConflictException quando a visita ja foi cancelada', async () => {
    const prisma = prismaFake({
      visitaExistente: visitaBruta({ canceladaEm: new Date() }),
    });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkout('u1', 'visita-1', { latitude: -23.5505, longitude: -46.6333 }),
    ).rejects.toThrow(ConflictException);
  });

  it('lanca ConflictException quando a visita ja teve checkout', async () => {
    const prisma = prismaFake({
      visitaExistente: visitaBruta({ checkoutEm: new Date('2026-01-01T11:00:00.000Z') }),
    });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkout('u1', 'visita-1', { latitude: -23.5505, longitude: -46.6333 }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.visita.update).not.toHaveBeenCalled();
  });

  it('lanca BadRequestException quando o checkout esta fora do raio de 50m do pin', async () => {
    const prisma = prismaFake({
      visitaExistente: visitaBruta({
        cliente: { localizacaoLat: decimalFake(-23.5505), localizacaoLng: decimalFake(-46.6333) },
      }),
    });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.checkout('u1', 'visita-1', { latitude: -23.56, longitude: -46.6333 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('atualiza checkoutEm/checkoutLat/checkoutLng e a distancia quando esta dentro do raio', async () => {
    const prisma = prismaFake({
      visitaExistente: visitaBruta({
        cliente: { localizacaoLat: decimalFake(-23.5505), localizacaoLng: decimalFake(-46.6333) },
      }),
    });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    const resultado = await service.checkout('u1', 'visita-1', {
      latitude: -23.5505,
      longitude: -46.6333,
    });

    expect(prisma.visita.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'visita-1' },
        data: expect.objectContaining({ checkoutLat: -23.5505, checkoutLng: -46.6333 }),
      }),
    );
    expect(resultado.checkoutEm).not.toBeNull();
  });
});

describe('VisitasService.cancelar', () => {
  it('lanca NotFoundException quando a visita nao existe ou nao pertence ao vendedor', async () => {
    const prisma = prismaFake({ visitaExistente: null });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(service.cancelar('u1', 'visita-1', 'errei o cliente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca ConflictException quando a visita ja foi cancelada', async () => {
    const prisma = prismaFake({ visitaExistente: visitaBruta({ canceladaEm: new Date() }) });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(service.cancelar('u1', 'visita-1', 'errei o cliente')).rejects.toThrow(
      ConflictException,
    );
  });

  it('lanca ConflictException quando a visita ja teve checkout', async () => {
    const prisma = prismaFake({
      visitaExistente: visitaBruta({ checkoutEm: new Date() }),
    });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(service.cancelar('u1', 'visita-1', 'errei o cliente')).rejects.toThrow(
      ConflictException,
    );
  });

  it('cancela e registra EventoNotificacao VISITA_CANCELADA na mesma transacao', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    const resultado = await service.cancelar('u1', 'visita-1', 'errei o cliente');

    expect(prisma._tx.visita.update).toHaveBeenCalledWith({
      where: { id: 'visita-1' },
      data: expect.objectContaining({ motivoCancelamento: 'errei o cliente' }),
    });
    expect(prisma._tx.eventoNotificacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'VISITA_CANCELADA', referenciaId: 'visita-1' }),
      }),
    );
    expect(resultado.canceladaEm).not.toBeNull();
  });
});

describe('VisitasService.listarPorCliente', () => {
  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(service.listarPorCliente('c1', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    await expect(
      service.listarPorCliente('c1', { tipo: 'NENHUM' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('retorna o historico do cliente em ordem cronologica decrescente', async () => {
    const prisma = prismaFake({
      visitasDoCliente: [
        visitaBruta({ id: 'v2', checkinEm: new Date('2026-01-02T00:00:00.000Z') }),
        visitaBruta({ id: 'v1', checkinEm: new Date('2026-01-01T00:00:00.000Z') }),
      ],
    });
    const service = new VisitasService(prisma as never, fotoStorageFake() as never);

    const resultado = await service.listarPorCliente('cliente-1', ESCOPO_TODOS);

    expect(prisma.visita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { checkinEm: 'desc' } }),
    );
    expect(resultado.map((v) => v.id)).toEqual(['v2', 'v1']);
  });
});
