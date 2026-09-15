// Mesmo shape de
// backend/src/tipos-acondicionamento/dto/tipo-acondicionamento-response.dto.ts
// - duplicado aqui por não haver pacote compartilhado entre front e back.
export interface TipoAcondicionamentoDto {
  id: string;
  nome: string;
  ativo: boolean;
  // null = retalho (corte fracionario livre); preenchido = tamanho fixo,
  // pedido tem que ser multiplo exato (OS-novas-implementacoes.md Bloco 4,
  // revisao).
  tamanhoPadrao: string | null;
}
