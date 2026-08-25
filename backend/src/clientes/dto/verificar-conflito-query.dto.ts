import { IsNotEmpty, IsString } from 'class-validator';

export class VerificarConflitoQueryDto {
  @IsString()
  @IsNotEmpty()
  documento!: string;
}
