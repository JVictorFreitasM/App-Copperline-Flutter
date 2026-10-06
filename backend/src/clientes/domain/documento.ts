import { cnpjEhValido, normalizarCnpj } from '../../consulta-cnpj/domain/cnpj';

// CPF/CNPJ do cliente: validacao por calculo (antes de qualquer consulta a
// base ou a API externa) e as formas em que o documento pode estar GRAVADO.
// O WK Radar devolve cpfCnpj formatado ("19.243.253/0001-14") e e' assim
// que o sync grava - buscar so pelos digitos nunca acha (ver
// variantesParaBusca).
export type TipoPessoa = 'Fisica' | 'Juridica';

export function normalizarDocumento(entrada: string): string {
  return normalizarCnpj(entrada);
}

function cpfEhValido(entrada: string): boolean {
  const cpf = entrada.replace(/[.\-\s]/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }
  const calcularDigito = (base: string, pesoInicial: number): number => {
    const soma = [...base].reduce(
      (acumulado, digito, indice) =>
        acumulado + Number(digito) * (pesoInicial - indice),
      0,
    );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    calcularDigito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calcularDigito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

// 11 digitos = CPF (pessoa fisica), 14 caracteres = CNPJ (juridica) - os
// tamanhos nunca colidem. null = nao e' nenhum dos dois, ou DV invalido.
export function tipoPessoaDoDocumento(entrada: string): TipoPessoa | null {
  const documento = normalizarDocumento(entrada);
  if (documento.length === 11) {
    return cpfEhValido(documento) ? 'Fisica' : null;
  }
  return cnpjEhValido(documento) ? 'Juridica' : null;
}

export function documentoEhValido(entrada: string): boolean {
  return tipoPessoaDoDocumento(entrada) !== null;
}

export function formatarDocumento(entrada: string): string {
  const documento = normalizarDocumento(entrada);
  if (documento.length === 11) {
    return `${documento.slice(0, 3)}.${documento.slice(3, 6)}.${documento.slice(6, 9)}-${documento.slice(9)}`;
  }
  if (documento.length === 14) {
    return `${documento.slice(0, 2)}.${documento.slice(2, 5)}.${documento.slice(5, 8)}/${documento.slice(8, 12)}-${documento.slice(12)}`;
  }
  return entrada;
}

// Valores de cpf_cnpj a procurar na base: so digitos E formatado.
export function variantesParaBusca(entrada: string): string[] {
  const documento = normalizarDocumento(entrada);
  return [...new Set([documento, formatarDocumento(documento)])];
}
