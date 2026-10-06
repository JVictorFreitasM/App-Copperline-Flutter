import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { IdempotenciaAcaoService } from '../idempotencia-acao/idempotencia-acao.service';
import { CriarPedidoService } from './criar-pedido.service';
import type { CriarPedidoResultadoDto } from './criar-pedido.service';
import type { CriarPedidoDto } from './dto/criar-pedido.dto';

// Envoltorio do POST /pedidos direto: quando o app manda `idLocal`, a mesma
// reserva da fila offline (IdempotenciaAcaoService) garante que o pedido e'
// criado UMA vez - o caso real e' o app desistir da resposta por timeout,
// enfileirar o mesmo pedido com o MESMO idLocal, e a fila reconhecer o pedido
// que o servidor ja criou em vez de criar outro. Sem idLocal (web), segue
// direto pro CriarPedidoService, como sempre.
@Injectable()
export class CriarPedidoIdempotenteService {
  private readonly logger = new Logger(CriarPedidoIdempotenteService.name);

  constructor(
    private readonly criarPedidoService: CriarPedidoService,
    private readonly idempotencia: IdempotenciaAcaoService,
  ) {}

  async criar(
    dto: CriarPedidoDto,
    usuarioId: string,
    escopo: EscopoClientes,
  ): Promise<CriarPedidoResultadoDto> {
    if (!dto.idLocal) {
      return this.criarPedidoService.criar(dto, usuarioId, escopo);
    }

    // Sem hash: o POST direto nao tem comprovante de fila, e o reenvio da
    // fila com o mesmo idLocal precisa reconhecer este pedido (sem conflito).
    const reserva = await this.idempotencia.reservar(
      usuarioId,
      dto.idLocal,
      'CRIAR_PEDIDO',
      null,
    );

    switch (reserva.situacao) {
      case 'em-processamento':
        throw new ConflictException('Este pedido já está sendo processado');
      case 'conflito':
        throw new ConflictException('Este idLocal já foi usado com outro conteúdo');
      case 'concluida':
        if (reserva.status === 'SUCESSO') {
          return reserva.resultado as CriarPedidoResultadoDto;
        }
        throw new BadRequestException(reserva.erro ?? 'Pedido rejeitado');
      case 'nova':
        break;
    }

    let resultado: CriarPedidoResultadoDto;
    try {
      resultado = await this.criarPedidoService.criar(dto, usuarioId, escopo);
    } catch (error) {
      await this.concluirSemFalhar(reserva.registroId, 'ERRO', undefined, mensagemDe(error));
      throw error;
    }
    // O pedido JA foi criado - falha ao gravar o resultado congelado nao pode
    // virar erro pro usuario (so enfraquece a idempotencia deste idLocal).
    await this.concluirSemFalhar(reserva.registroId, 'SUCESSO', resultado);
    return resultado;
  }

  private async concluirSemFalhar(
    registroId: string,
    status: 'SUCESSO' | 'ERRO',
    resultado?: unknown,
    erro?: string,
  ): Promise<void> {
    try {
      await this.idempotencia.concluir(registroId, status, resultado, erro);
    } catch (error) {
      this.logger.error(
        `Falha ao registrar resultado da reserva ${registroId}: ${mensagemDe(error)}`,
      );
    }
  }
}

function mensagemDe(error: unknown): string {
  if (error instanceof HttpException) {
    const resposta = error.getResponse();
    if (typeof resposta === 'string') return resposta;
    if (typeof resposta === 'object' && resposta !== null && 'message' in resposta) {
      const mensagem = (resposta as { message: unknown }).message;
      return Array.isArray(mensagem) ? mensagem.join('; ') : String(mensagem);
    }
  }
  return error instanceof Error ? error.message : String(error);
}
