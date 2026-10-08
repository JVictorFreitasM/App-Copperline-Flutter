import { FilaPendenteService } from './fila-pendente.service';
import type { AcaoFilaDto } from './dto/fila-pendente.dto';
import type { IdpUser } from '@copperline/idp-client';
import { comprovanteDaAcao } from './hash-acao';
import { IdempotenciaAcaoService } from '../idempotencia-acao/idempotencia-acao.service';

const IDP_USER: IdpUser = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

function prismaFake(overrides: { jaProcessada?: Record<string, unknown> | null } = {}) {
  const registros = new Map<string, Record<string, unknown>>();
  return {
    acaoFilaProcessada: {
      findUnique: jest.fn().mockImplementation(async () => {
        if ('jaProcessada' in overrides) return overrides.jaProcessada;
        return null;
      }),
      // Reserva: se ja existe registro (override), viola a unicidade como o banco.
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        if (overrides.jaProcessada) {
          throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
        }
        registros.set(data.idLocal as string, data);
        return { id: `registro-${data.idLocal as string}`, ...data };
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    _registros: registros,
  };
}

// FilaPendenteService depende da idempotencia, nao do prisma direto - aqui
// usa a implementacao REAL sobre o prisma fake.
function idempotenciaDe(prisma: ReturnType<typeof prismaFake>) {
  return new IdempotenciaAcaoService(prisma as never);
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

function funcionalidadesFake(envioPedidosHabilitado = true) {
  return { obter: jest.fn().mockResolvedValue({ envioPedidosHabilitado, cadastroClientesHabilitado: true }) };
}

function montarService(prisma: ReturnType<typeof prismaFake>) {
  return new FilaPendenteService(
    idempotenciaDe(prisma) as never,
    criarPedidoServiceFake() as never,
    visitasServiceFake() as never,
    rastreioServiceFake() as never,
    vendedorEscopoServiceFake() as never,
    funcionalidadesFake() as never,
  );
}

describe('FilaPendenteService.processar - ack/integridade', () => {
  it('devolve o ack (hash + bytes) do que recebeu e grava o hash junto do resultado', async () => {
    const prisma = prismaFake();
    const service = montarService(prisma);
    const esperado = comprovanteDaAcao(acao());

    const [resultado] = await service.processar('u1', IDP_USER, [
      acao({ hash: esperado.hash }),
    ]);

    expect(resultado.status).toBe('SUCESSO');
    expect(resultado.ack).toEqual(esperado);
    expect(prisma.acaoFilaProcessada.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payloadHash: esperado.hash }) }),
    );
  });

  it('hash do app diferente do recebido: NAO processa nem registra (app reenvia)', async () => {
    const prisma = prismaFake();
    const rastreioService = rastreioServiceFake();
    const service = new FilaPendenteService(
      idempotenciaDe(prisma) as never,
      criarPedidoServiceFake() as never,
      visitasServiceFake() as never,
      rastreioService as never,
      vendedorEscopoServiceFake() as never,
      funcionalidadesFake() as never,
    );

    const [resultado] = await service.processar('u1', IDP_USER, [acao({ hash: 'a'.repeat(64) })]);

    expect(resultado.status).toBe('ERRO');
    expect(resultado.erro).toContain('Integridade');
    expect(rastreioService.registrarLote).not.toHaveBeenCalled();
    expect(prisma.acaoFilaProcessada.create).not.toHaveBeenCalled();
  });

  it('mesmo idLocal ja processado com conteudo DIFERENTE vira conflito (nunca devolve sucesso de outra acao)', async () => {
    const prisma = prismaFake({
      jaProcessada: {
        status: 'SUCESSO',
        resultado: { loteId: 'lote-1' },
        erro: null,
        payloadHash: 'b'.repeat(64),
      },
    });
    const service = montarService(prisma);

    const [resultado] = await service.processar('u1', IDP_USER, [acao()]);

    expect(resultado.status).toBe('ERRO');
    expect(resultado.erro).toContain('Conflito');
  });

  it('reenvio do mesmo conteudo devolve o hash GRAVADO na primeira vez', async () => {
    const hash = comprovanteDaAcao(acao()).hash;
    const prisma = prismaFake({
      jaProcessada: { status: 'SUCESSO', resultado: { loteId: 'lote-1' }, erro: null, payloadHash: hash },
    });
    const service = montarService(prisma);

    const [resultado] = await service.processar('u1', IDP_USER, [acao({ hash })]);

    expect(resultado.ack?.hash).toBe(hash);
    expect(prisma.acaoFilaProcessada.update).not.toHaveBeenCalled();
  });
});

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
      idempotenciaDe(prisma) as never,
      criarPedidoServiceFake() as never,
      visitasServiceFake() as never,
      rastreioService as never,
      vendedorEscopoServiceFake() as never,
      funcionalidadesFake() as never,
    );

    const resultado = await service.processar('u1', IDP_USER, [acao()]);

    expect(rastreioService.registrarLote).not.toHaveBeenCalled();
    expect(prisma.acaoFilaProcessada.update).not.toHaveBeenCalled();
    expect(resultado).toEqual([
      {
        idLocal: 'acao-1',
        status: 'SUCESSO',
        resultado: { loteId: 'lote-1', quantidade: 2 },
        erro: undefined,
        ack: { hash: comprovanteDaAcao(acao()).hash, bytes: comprovanteDaAcao(acao()).bytes },
      },
    ]);
  });

  it('grava o resultado apos executar com sucesso pela primeira vez', async () => {
    const prisma = prismaFake();
    const service = montarService(prisma);

    const resultado = await service.processar('u1', IDP_USER, [acao()]);

    // Reserva ANTES de executar (PROCESSANDO) e resultado gravado depois.
    expect(prisma.acaoFilaProcessada.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ idLocal: 'acao-1', status: 'PROCESSANDO' }),
    });
    expect(prisma.acaoFilaProcessada.update).toHaveBeenCalledWith({
      where: { id: 'registro-acao-1' },
      data: expect.objectContaining({ status: 'SUCESSO' }),
    });
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
      idempotenciaDe(prisma) as never,
      criarPedidoServiceFake() as never,
      visitasService as never,
      rastreioService as never,
      vendedorEscopoServiceFake() as never,
      funcionalidadesFake() as never,
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
      idempotenciaDe(prisma) as never,
      criarPedidoService as never,
      visitasServiceFake() as never,
      rastreioServiceFake() as never,
      vendedorEscopoService as never,
      funcionalidadesFake() as never,
    );

    await service.processar('u1', IDP_USER, [
      acao({
        tipo: 'CRIAR_PEDIDO',
        payload: {
          clienteId: '11111111-1111-4111-8111-111111111111',
          formaPagamentoId: '33333333-3333-4333-8333-333333333333',
          condicaoPagamentoId: '44444444-4444-4444-8444-444444444444',
          itens: [
            {
              produtoId: '22222222-2222-4222-8222-222222222222',
              metrosDesejados: 90,
              percentualDesconto: 10,
            },
          ],
        },
      }),
    ]);

    expect(vendedorEscopoService.resolverEscopoClientes).toHaveBeenCalledWith(IDP_USER, 'u1');
    expect(criarPedidoService.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        itens: [expect.objectContaining({ percentualDesconto: 10 })],
      }),
      'u1',
      { tipo: 'TODOS' },
    );
  });

  it('CHECKIN_VISITA decodifica a foto base64 e usa o timestamp da acao como momento do check-in', async () => {
    const prisma = prismaFake();
    const visitasService = visitasServiceFake();
    const service = new FilaPendenteService(
      idempotenciaDe(prisma) as never,
      criarPedidoServiceFake() as never,
      visitasService as never,
      rastreioServiceFake() as never,
      vendedorEscopoServiceFake() as never,
      funcionalidadesFake() as never,
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
      idempotenciaDe(prisma) as never,
      criarPedidoServiceFake() as never,
      visitasServiceFake() as never,
      rastreioService as never,
      vendedorEscopoServiceFake() as never,
      funcionalidadesFake() as never,
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
      idempotenciaDe(prisma) as never,
      criarPedidoServiceFake() as never,
      visitasService as never,
      rastreioServiceFake() as never,
      vendedorEscopoServiceFake() as never,
      funcionalidadesFake() as never,
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

describe('FilaPendenteService.processar - concorrencia', () => {
  it('mesmo idLocal ja reservado por outra requisicao (PROCESSANDO) NAO executa e devolve PROCESSANDO', async () => {
    const hash = comprovanteDaAcao(acao()).hash;
    const prisma = prismaFake({
      jaProcessada: { id: 'r1', status: 'PROCESSANDO', resultado: null, erro: null, payloadHash: hash },
    });
    const rastreioService = rastreioServiceFake();
    const service = new FilaPendenteService(
      idempotenciaDe(prisma) as never,
      criarPedidoServiceFake() as never,
      visitasServiceFake() as never,
      rastreioService as never,
      vendedorEscopoServiceFake() as never,
      funcionalidadesFake() as never,
    );

    const [resultado] = await service.processar('u1', IDP_USER, [acao({ hash })]);

    expect(resultado.status).toBe('PROCESSANDO');
    expect(rastreioService.registrarLote).not.toHaveBeenCalled();
  });
});

describe('FilaPendenteService.processar - envio de pedidos desativado', () => {
  const pedido = (salvarComoOrcamento?: boolean) =>
    acao({ tipo: 'CRIAR_PEDIDO', payload: { salvarComoOrcamento } as never });

  function montarComEnvio(envioPedidosHabilitado: boolean) {
    const prisma = prismaFake();
    const criarPedido = criarPedidoServiceFake();
    const service = new FilaPendenteService(
      idempotenciaDe(prisma) as never,
      criarPedido as never,
      visitasServiceFake() as never,
      rastreioServiceFake() as never,
      vendedorEscopoServiceFake() as never,
      funcionalidadesFake(envioPedidosHabilitado) as never,
    );
    return { service, prisma, criarPedido };
  }

  it('pedido que iria ao ERP fica retido (PROCESSANDO), sem reservar o idLocal nem executar', async () => {
    const { service, prisma, criarPedido } = montarComEnvio(false);

    const [resultado] = await service.processar('u1', IDP_USER, [pedido()]);

    expect(resultado.status).toBe('PROCESSANDO');
    expect(criarPedido.criar).not.toHaveBeenCalled();
    expect(prisma.acaoFilaProcessada.create).not.toHaveBeenCalled();
  });

  it('orcamento (salvarComoOrcamento) passa direto mesmo com o envio desativado', async () => {
    const { service } = montarComEnvio(false);

    const [resultado] = await service.processar('u1', IDP_USER, [
      acao({ tipo: 'CRIAR_PEDIDO', payload: { salvarComoOrcamento: true } as never }),
    ]);

    // Segue o fluxo normal (a validacao do payload de teste falha por ser minimo,
    // o que importa e' nao ter sido retido).
    expect(resultado.status).not.toBe('PROCESSANDO');
  });

  it('com o envio ativo nao retem nada', async () => {
    const { service } = montarComEnvio(true);

    const [resultado] = await service.processar('u1', IDP_USER, [pedido()]);

    expect(resultado.status).not.toBe('PROCESSANDO');
  });
});
