// Mesmo ajuste de fim de dia ja usado em pedidos.service.ts (dataFinal
// chega como "YYYY-MM-DD" puro, sem isso o dia final ficaria excluido do
// filtro por comparar contra 00:00). Retorna undefined quando nenhum dos
// dois limites foi informado - Prisma ignora campo `undefined` no `where`
// (equivale a "sem filtro"), nao precisa de spread condicional no call site.
export function filtroPeriodo(
  dataInicial?: string,
  dataFinal?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!dataInicial && !dataFinal) {
    return undefined;
  }
  return {
    ...(dataInicial && { gte: new Date(dataInicial) }),
    ...(dataFinal && { lte: new Date(`${dataFinal}T23:59:59.999Z`) }),
  };
}
