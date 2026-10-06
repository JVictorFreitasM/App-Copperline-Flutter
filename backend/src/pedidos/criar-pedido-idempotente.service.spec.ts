import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ReservaAcao } from '../idempotencia-acao/idempotencia-acao.service';
import { CriarPedidoIdempotenteService } from './criar-pedido-idempotente.service';
import type { CriarPedidoDto } from './dto/criar-pedido.dto';

const ESCOPO = { tipo: 'TODOS' } as never;
const RESULTADO = { status: 'ENVIADO', pedidoId: 'pedido-1' };

function montar(reserva?: ReservaAcao) {
  const criarPedidoService = { criar: jest.fn().mockResolvedValue(RESULTADO) };
  const idempotencia = {
    reservar: jest.fn().mockResolvedValue(reserva),
    concluir: jest.fn().mockResolvedValue(undefined),
  };
  const service = new CriarPedidoIdempotenteService(
    criarPedidoService as never,
    idempotencia as never,
  );
  return { service, criarPedidoService, idempotencia };
}

function dto(idLocal?: string): CriarPedidoDto {
  return { idLocal } as CriarPedidoDto;
}

describe('CriarPedidoIdempotenteService', () => {
  it('sem idLocal (web) cria direto, sem tocar na idempotencia', async () => {
    const { service, criarPedidoService, idempotencia } = montar();

    expect(await service.criar(dto(), 'u1', ESCOPO)).toEqual(RESULTADO);

    expect(criarPedidoService.criar).toHaveBeenCalledTimes(1);
    expect(idempotencia.reservar).not.toHaveBeenCalled();
  });

  it('com idLocal novo reserva (sem hash), cria e congela o resultado', async () => {
    const { service, criarPedidoService, idempotencia } = montar({
      situacao: 'nova',
      registroId: 'r1',
    });

    expect(await service.criar(dto('id-1'), 'u1', ESCOPO)).toEqual(RESULTADO);

    expect(idempotencia.reservar).toHaveBeenCalledWith('u1', 'id-1', 'CRIAR_PEDIDO', null);
    expect(criarPedidoService.criar).toHaveBeenCalledTimes(1);
    expect(idempotencia.concluir).toHaveBeenCalledWith('r1', 'SUCESSO', RESULTADO, undefined);
  });

  it('idLocal ja concluido com sucesso devolve o pedido existente sem criar outro', async () => {
    const { service, criarPedidoService } = montar({
      situacao: 'concluida',
      status: 'SUCESSO',
      resultado: RESULTADO,
      payloadHash: null,
    });

    expect(await service.criar(dto('id-1'), 'u1', ESCOPO)).toEqual(RESULTADO);
    expect(criarPedidoService.criar).not.toHaveBeenCalled();
  });

  it('idLocal ja concluido com erro repete o erro congelado', async () => {
    const { service, criarPedidoService } = montar({
      situacao: 'concluida',
      status: 'ERRO',
      erro: 'Desconto acima do limite',
      payloadHash: null,
    });

    await expect(service.criar(dto('id-1'), 'u1', ESCOPO)).rejects.toThrow(
      new BadRequestException('Desconto acima do limite'),
    );
    expect(criarPedidoService.criar).not.toHaveBeenCalled();
  });

  it('requisicao concorrente com o mesmo idLocal recebe 409 e NAO cria', async () => {
    const { service, criarPedidoService } = montar({ situacao: 'em-processamento' });

    await expect(service.criar(dto('id-1'), 'u1', ESCOPO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(criarPedidoService.criar).not.toHaveBeenCalled();
  });

  it('erro ao criar congela ERRO e propaga o erro original', async () => {
    const { service, criarPedidoService, idempotencia } = montar({
      situacao: 'nova',
      registroId: 'r1',
    });
    const erro = new BadRequestException('Desconto acima do limite');
    criarPedidoService.criar.mockRejectedValue(erro);

    await expect(service.criar(dto('id-1'), 'u1', ESCOPO)).rejects.toBe(erro);
    expect(idempotencia.concluir).toHaveBeenCalledWith(
      'r1',
      'ERRO',
      undefined,
      'Desconto acima do limite',
    );
  });

  it('falha ao gravar o resultado NAO vira erro pro usuario (o pedido ja foi criado)', async () => {
    const { service, idempotencia } = montar({ situacao: 'nova', registroId: 'r1' });
    idempotencia.concluir.mockRejectedValue(new Error('banco fora'));

    expect(await service.criar(dto('id-1'), 'u1', ESCOPO)).toEqual(RESULTADO);
  });
});
