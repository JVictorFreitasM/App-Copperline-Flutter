import { IsString, MinLength } from 'class-validator';

export class CriarChaveLlmDto {
  @IsString()
  @MinLength(1)
  rotulo!: string;

  @IsString()
  @MinLength(1)
  apiKey!: string;
}
