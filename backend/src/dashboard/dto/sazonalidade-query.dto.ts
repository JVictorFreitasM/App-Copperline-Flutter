import { IsUUID } from 'class-validator';

export class SazonalidadeQueryDto {
  @IsUUID()
  produtoId!: string;
}
