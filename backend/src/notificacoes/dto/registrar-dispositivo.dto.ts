import { IsIn, IsNotEmpty, IsString } from 'class-validator';

const PLATAFORMAS = ['ANDROID', 'IOS', 'WEB'] as const;

export class RegistrarDispositivoDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsIn(PLATAFORMAS)
  plataforma!: (typeof PLATAFORMAS)[number];
}
