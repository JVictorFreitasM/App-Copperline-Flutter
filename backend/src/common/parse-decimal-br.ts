// QuantidadeDisponivel do Estoque.svc vem em formato BR (ex: "14,5830" ou
// "4.954,4349" - ponto como separador de milhar, virgula como decimal) - ao
// contrario dos demais campos numericos ja sincronizados no projeto (WK
// Radar REST, ver produto.sync.ts), que ja vem no formato que o Prisma
// aceita direto. Precisa de parse explicito antes de persistir como
// Decimal - nunca gravar a string crua nem fazer Number() direto (que
// interpretaria "14,5830" errado).
export function parseDecimalBr(valor: string): string {
  const normalizado = valor.trim().replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) {
    throw new Error(`Valor '${valor}' nao e um decimal BR valido`);
  }
  return normalizado;
}
