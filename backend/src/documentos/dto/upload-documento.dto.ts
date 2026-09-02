import { IsString, MaxLength, MinLength } from 'class-validator';

// multipart/form-data (o arquivo viaja junto, ver
// AdminDocumentosController.upload) - campos de texto chegam como string.
export class UploadDocumentoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nome!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  categoria!: string;
}
