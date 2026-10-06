// CEP: 8 digitos, com ou sem hifen. Regra de dominio pura - roda ANTES de
// qualquer chamada ao provedor externo.
const FORMATO_NORMALIZADO = /^\d{8}$/;

export function normalizarCep(entrada: string): string {
  return entrada.replace(/[.\-\s]/g, '');
}

export function cepEhValido(entrada: string): boolean {
  const cep = normalizarCep(entrada);
  // 00000000 passa no formato mas nao existe.
  return FORMATO_NORMALIZADO.test(cep) && !/^0{8}$/.test(cep);
}
