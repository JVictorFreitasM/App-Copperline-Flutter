import { IsObject } from 'class-validator';

// `valores`: chave -> texto. Ausente = nao mexe; "" = volta a valer a env.
// As chaves aceitas sao validadas no CredenciaisErpService (lista fechada).
export class AtualizarCredenciaisErpDto {
  @IsObject()
  valores!: Record<string, string | null>;
}
