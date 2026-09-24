import { ArrayMinSize, IsArray, IsString } from 'class-validator';

// Lista COMPLETA de ids na nova ordem (drag-and-drop no client manda o
// array inteiro reordenado, nao um swap de dois) - ver ChaveLlmService.reordenar.
export class ReordenarChavesLlmDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}
