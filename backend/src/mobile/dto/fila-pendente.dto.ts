import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsUUID,
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
}

export class EnviarFilaPendenteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TAMANHO_MAXIMO_FILA)
  @ValidateNested({ each: true })
  @Type(() => AcaoFilaDto)
  acoes!: AcaoFilaDto[];
}

export interface ResultadoAcaoFilaDto {
  idLocal: string;
  status: 'SUCESSO' | 'ERRO';
  resultado?: unknown;
  erro?: string;
}
