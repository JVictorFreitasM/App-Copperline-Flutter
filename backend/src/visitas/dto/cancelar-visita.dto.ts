import { IsNotEmpty, IsString } from 'class-validator';

export class CancelarVisitaDto {
  // Obrigatorio - "cancela mediante um comentario" (repassado ao
  // supervisor via push, ver VisitasService.cancelar).
  @IsString()
  @IsNotEmpty()
  comentario!: string;
}
