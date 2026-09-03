// Converte "YYYY-MM" (mesAno de MetaVendedor) no intervalo [gte, lte] do
// mes inteiro em UTC - mesmo criterio de fim-de-periodo ja usado em
// filtro-periodo.ts (dashboard), so calculando o ultimo dia do mes em vez
// de receber uma dataFinal explicita.
export function filtroMes(mesAno: string): { gte: Date; lte: Date } {
  const [ano, mes] = mesAno.split('-').map(Number);
  const gte = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0));
  const lte = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
  return { gte, lte };
}
