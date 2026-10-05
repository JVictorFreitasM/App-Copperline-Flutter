// Validacao de CNPJ (numerico e alfanumerico - formato novo da Receita,
// 12 primeiras posicoes [0-9A-Z] + 2 digitos verificadores numericos).
// Regra de dominio pura, sem dependencia de HTTP/Prisma - roda ANTES de
// qualquer chamada ao provedor externo, que tem limite de requisicoes.
const PESOS_PRIMEIRO_DV = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DV = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const FORMATO_NORMALIZADO = /^[0-9A-Z]{12}[0-9]{2}$/;

export function normalizarCnpj(entrada: string): string {
  return entrada.replace(/[.\-/\s]/g, '').toUpperCase();
}

// Valor de cada caractere no calculo do DV: codigo ASCII - 48 ('0'=0,
// '9'=9, 'A'=17, 'Z'=42).
function valorDoCaractere(caractere: string): number {
  return caractere.charCodeAt(0) - 48;
}

function calcularDigito(base: string, pesos: number[]): number {
  const soma = [...base].reduce(
    (acumulado, caractere, indice) =>
      acumulado + valorDoCaractere(caractere) * pesos[indice],
    0,
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjEhValido(entrada: string): boolean {
  const cnpj = normalizarCnpj(entrada);
  if (!FORMATO_NORMALIZADO.test(cnpj)) {
    return false;
  }
  // Sequencia de um caractere so (ex: 00000000000000) passa no calculo do
  // DV mas nao e' um CNPJ real.
  if (/^(.)\1{13}$/.test(cnpj)) {
    return false;
  }

  const primeiroDv = calcularDigito(cnpj.slice(0, 12), PESOS_PRIMEIRO_DV);
  const segundoDv = calcularDigito(cnpj.slice(0, 13), PESOS_SEGUNDO_DV);
  return cnpj.endsWith(`${primeiroDv}${segundoDv}`);
}
