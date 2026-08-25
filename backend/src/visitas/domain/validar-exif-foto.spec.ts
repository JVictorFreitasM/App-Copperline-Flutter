import {
  FotoDataHoraDivergenteError,
  FotoSemExifDataHoraError,
  validarExifDataHora,
} from './validar-exif-foto';

describe('validarExifDataHora', () => {
  it('lanca FotoSemExifDataHoraError quando nao ha EXIF nenhum', () => {
    expect(() => validarExifDataHora(undefined, new Date())).toThrow(
      FotoSemExifDataHoraError,
    );
  });

  it('lanca FotoSemExifDataHoraError quando EXIF existe mas sem data', () => {
    expect(() => validarExifDataHora({}, new Date())).toThrow(FotoSemExifDataHoraError);
  });

  it('aceita quando DateTimeOriginal esta dentro da tolerancia', () => {
    const momento = new Date('2026-01-01T10:00:00.000Z');
    const dataFoto = new Date('2026-01-01T10:02:00.000Z'); // 2 min depois

    expect(() =>
      validarExifDataHora({ DateTimeOriginal: dataFoto }, momento),
    ).not.toThrow();
  });

  it('usa CreateDate como fallback quando DateTimeOriginal nao existe', () => {
    const momento = new Date('2026-01-01T10:00:00.000Z');
    const dataFoto = new Date('2026-01-01T10:01:00.000Z');

    expect(() => validarExifDataHora({ CreateDate: dataFoto }, momento)).not.toThrow();
  });

  it('lanca FotoDataHoraDivergenteError quando a foto e muito mais antiga que o check-in', () => {
    const momento = new Date('2026-01-01T10:00:00.000Z');
    const dataFoto = new Date('2025-06-01T10:00:00.000Z'); // meses antes

    expect(() =>
      validarExifDataHora({ DateTimeOriginal: dataFoto }, momento),
    ).toThrow(FotoDataHoraDivergenteError);
  });

  it('lanca FotoDataHoraDivergenteError mesmo pra uma diferenca pequena acima da tolerancia', () => {
    const momento = new Date('2026-01-01T10:00:00.000Z');
    const dataFoto = new Date('2026-01-01T10:06:00.000Z'); // 6 min depois (tolerancia e 5)

    expect(() =>
      validarExifDataHora({ DateTimeOriginal: dataFoto }, momento),
    ).toThrow(FotoDataHoraDivergenteError);
  });
});
