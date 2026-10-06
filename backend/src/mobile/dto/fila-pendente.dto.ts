import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

// Tipos suportados pela fila (OS-BACKEND-29) - espelham exatamente as
// dependencias listadas na OS (pedido/visita/rastreio). Adicionar um novo
// tipo de acao offline no futuro = adicionar aqui + um novo DTO de
// payload + um novo case em FilaPendenteService.executar, sem tocar no
// resto do fluxo (validacao/idempotencia/persistencia sao genericas).
export const TIPOS_ACAO_FILA = [
  'CRIAR_PEDIDO',
  'CHECKIN_VISITA',
  'CHECKOUT_VISITA',
  'CANCELAR_VISITA',
  'RASTREIO_LOTE',
] as const;
export type TipoAcaoFila = (typeof TIPOS_ACAO_FILA)[number];

// Teto de seguranca por chamada - um vendedor offline por dias acumula
// acoes, mas nao um numero irrealista de uma vez (indicio de bug no app
// se passar disso).
export const TAMANHO_MAXIMO_FILA = 500;

export class AcaoFilaDto {
  // Gerado no DISPOSITIVO - chave de idempotencia (criterio de aceite:
  // reenviar a mesma acao nao duplica o efeito). Ver
  // AcaoFilaProcessada.@@unique([usuarioId, idLocal]).
  @IsUUID()
  idLocal!: string;

  @IsIn(TIPOS_ACAO_FILA)
  tipo!: TipoAcaoFila;

  // Momento em que a acao aconteceu de VERDADE no dispositivo (nao o
  // momento do envio) - usado como capturadoEm/checkinEm/checkoutEm/
  // canceladaEm conforme o tipo (ver FilaPendenteService.executar).
  @IsISO8601()
  timestamp!: string;

  // Validado por tipo dentro de FilaPendenteService (nao da pra tipar uma
  // uniao heterogenea com class-validator sem um decorator por subtipo,
  // ver discussao em nest-endpoint) - payload invalido vira status ERRO
  // so PRO ITEM em questao, nunca rejeita a chamada inteira.
  @IsObject()
  payload!: Record<string, unknown>;

  // SHA-256 (hex) que o DISPOSITIVO calculou sobre {idLocal,tipo,timestamp,
  // payload} em JSON canonico (ver hash-acao.ts). O servidor recalcula
  // sobre o que RECEBEU: se diferir (corpo truncado/corrompido em transito),
  // a acao NAO e processada e o app reenvia - nunca grava dado pela metade.
  // Opcional so' pra versoes antigas do app; o app novo sempre manda.
  @IsOptional()
  @IsString()
  @Length(64, 64)
  hash?: string;
}

export class EnviarFilaPendenteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TAMANHO_MAXIMO_FILA)
  @ValidateNested({ each: true })
  @Type(() => AcaoFilaDto)
  acoes!: AcaoFilaDto[];
}

// Comprovante (ack) do que o servidor recebeu de uma acao - o app so'
// considera a acao entregue quando ack.hash bate com o hash que ele enviou.
export interface AckAcaoFilaDto {
  hash: string;
  bytes: number;
}

export interface ResultadoAcaoFilaDto {
  idLocal: string;
  // PROCESSANDO: a mesma acao ja esta sendo executada por outra requisicao
  // - o app mantem PENDENTE e reenvia depois.
  status: 'SUCESSO' | 'ERRO' | 'PROCESSANDO';
  resultado?: unknown;
  erro?: string;
  ack?: AckAcaoFilaDto;
}
