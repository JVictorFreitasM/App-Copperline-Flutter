import { IsBase64, IsUUID } from 'class-validator';
import { CriarPedidoDto } from '../../pedidos/dto/criar-pedido.dto';
import { CancelarVisitaDto } from '../../visitas/dto/cancelar-visita.dto';
import { CheckinVisitaDto } from '../../visitas/dto/checkin-visita.dto';
import { CheckoutVisitaDto } from '../../visitas/dto/checkout-visita.dto';
import { EnviarLoteRastreioDto } from '../../rastreio/dto/enviar-lote-rastreio.dto';

// Reaproveita EXATAMENTE os DTOs ja validados dos endpoints ao vivo
// (nunca duplica regra de validacao) - so estende onde o payload da fila
// precisa de algo que o endpoint HTTP normal resolve de outro jeito (foto
// via multipart, visitaId via :id na URL).

export class CriarPedidoOfflineDto extends CriarPedidoDto {}

export class CheckinVisitaOfflineDto extends CheckinVisitaDto {
  // multipart nos outros endpoints - aqui a fila e' JSON puro, entao a
  // foto viaja em base64 (decisao confirmada com o usuario: aumenta o
  // payload, mas mantem a fila inteira como um unico POST).
  @IsBase64()
  foto!: string;
}

export class CheckoutVisitaOfflineDto extends CheckoutVisitaDto {
  @IsUUID()
  visitaId!: string;
}

export class CancelarVisitaOfflineDto extends CancelarVisitaDto {
  @IsUUID()
  visitaId!: string;
}

export class RastreioLoteOfflineDto extends EnviarLoteRastreioDto {}
