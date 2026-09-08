// Datas do formato "DD/MM/AAAA HH:mm" (WK Radar, ex: Empresarial.svc) -
// "00/00/0000 00:00" e' o sentinel do ERP pra "sem data" (nao uma data
// real), sempre vira null. Mesmo raciocinio de parse-decimal-br.ts: nunca
// gravar a string crua nem tentar `new Date(string)` direto (formato BR
// nao e' ISO, seria interpretado errado ou como Invalid Date).
export function parseDataHoraBr(valor: string): Date | null {
  const texto = valor.trim();
  if (texto.startsWith('00/00/0000')) {
    return null;
  }

  const [dataParte, horaParte] = texto.split(' ');
  const partesData = dataParte?.split('/').map(Number) ?? [];
  const [dia, mes, ano] = partesData;
  if (!dia || !mes || !ano || partesData.length !== 3) {
    throw new Error(`Valor '${valor}' nao e uma data BR valida`);
  }

  const [hora, minuto] = (horaParte ?? '00:00').split(':').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, hora || 0, minuto || 0));
}
