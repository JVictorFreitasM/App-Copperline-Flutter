// Mesmo shape de backend/src/rastreio/rastreio.service.ts
// (PosicaoAtualVendedorDto/TrajetoVendedorDto, GET /rastreio/equipe*) -
// duplicado aqui por não haver pacote compartilhado entre front e back.
// Já vem escopado por hierarquia do lado do backend (VendedorEscopoService)
// - o front só desenha o que recebe, nunca decide "quem é da minha
// equipe" (critério de aceite da OS-WEB-24).
export interface PosicaoAtualVendedorDto {
  vendedorId: string;
  vendedorNome: string | null;
  latitude: number;
  longitude: number;
  capturadoEm: string;
}

export interface PontoTrajetoDto {
  latitude: number;
  longitude: number;
  capturadoEm: string;
}

export interface TrajetoVendedorDto {
  vendedorId: string;
  data: string;
  pontos: PontoTrajetoDto[];
}
