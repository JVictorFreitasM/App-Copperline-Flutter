// Anti-fraude (extensao pos-OS-BACKEND-28, decisao confirmada com o
// usuario: bloquear, nao so avisar): exige que a foto do check-in tenha
// metadado EXIF de data/hora, e que essa data/hora bata com o momento do
// check-in dentro de uma tolerancia - dificulta (nao impede 100%, EXIF
// pode ser forjado por quem realmente quiser) o uso de foto antiga/da
// galeria como se fosse tirada na hora. "So camera, nunca upload" em si e'
// uma restricao de UI do app mobile (fora do alcance do backend) - o que
// da pra validar aqui e' essa correspondencia de data/hora.
export class FotoSemExifDataHoraError extends Error {}
export class FotoDataHoraDivergenteError extends Error {}

const TOLERANCIA_MS = 5 * 60 * 1000; // 5 minutos

export interface ExifDadosData {
  DateTimeOriginal?: Date;
  CreateDate?: Date;
}

export function validarExifDataHora(
  exif: ExifDadosData | undefined,
  momentoCheckin: Date,
): void {
  const dataFoto = exif?.DateTimeOriginal ?? exif?.CreateDate;
  if (!dataFoto) {
    throw new FotoSemExifDataHoraError(
      'Foto sem metadado de data/hora (EXIF) - tire a foto novamente pela câmera do app',
    );
  }

  const diferencaMs = Math.abs(dataFoto.getTime() - momentoCheckin.getTime());
  if (diferencaMs > TOLERANCIA_MS) {
    throw new FotoDataHoraDivergenteError(
      `Data/hora da foto (${dataFoto.toISOString()}) não corresponde ao momento do check-in (${momentoCheckin.toISOString()})`,
    );
  }
}
