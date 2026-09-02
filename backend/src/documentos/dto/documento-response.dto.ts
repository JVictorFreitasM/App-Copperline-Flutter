import type { Documento, Usuario } from '../../../generated/prisma/client';

// enviadoPor exposto so como nome (nunca id/email do Usuario local, que e'
// detalhe interno) - suficiente pro criterio de aceite (listagem exibe
// quem enviou), sem vazar mais dado do que a tela precisa.
export interface DocumentoDto {
  id: string;
  nome: string;
  categoria: string;
  tipoMime: string;
  tamanhoBytes: number;
  enviadoPor: string;
  criadoEm: Date;
}

type DocumentoComEnviadoPor = Documento & { enviadoPor: Usuario };

export function paraDocumentoDto(documento: DocumentoComEnviadoPor): DocumentoDto {
  return {
    id: documento.id,
    nome: documento.nome,
    categoria: documento.categoria,
    tipoMime: documento.tipoMime,
    tamanhoBytes: documento.tamanhoBytes,
    enviadoPor: documento.enviadoPor.nome,
    criadoEm: documento.criadoEm,
  };
}
