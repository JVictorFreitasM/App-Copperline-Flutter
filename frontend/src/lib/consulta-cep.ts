// Mesmo shape de backend/src/consulta-cep/dto/consulta-cep-response.dto.ts
// (GET /consulta-cep/:cep) - duplicado aqui por não haver pacote
// compartilhado entre front e back.
export interface ConsultaCepDto {
  cep: string;
  cepFormatado: string;
  uf: string | null;
  localidade: string | null;
  bairro: string | null;
  logradouro: string | null;
  complemento: string | null;
  unidade: string | null;
  codigoIbge: string | null;
}

// Espelha backend/src/consulta-cep/domain/cep.ts - validado no front antes
// de qualquer chamada à API (o backend valida de novo).
export function normalizarCep(entrada: string): string {
  return entrada.replace(/[.\-\s]/g, "");
}

export function cepEhValido(entrada: string): boolean {
  const cep = normalizarCep(entrada);
  return /^\d{8}$/.test(cep) && !/^0{8}$/.test(cep);
}
