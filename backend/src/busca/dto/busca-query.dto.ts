import { IsNotEmpty, IsString } from 'class-validator';

export class BuscaQueryDto {
  @IsString()
  @IsNotEmpty()
  q!: string;
}
