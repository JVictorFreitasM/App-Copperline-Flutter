// Converte "YYYY-Www" (periodo de MetaVendedor quando periodicidade =
// SEMANAL, mesmo formato que <input type="week"> do navegador produz) no
// intervalo [gte, lte] da semana ISO-8601 inteira (segunda a domingo) em
// UTC - pedido explicito do usuario (2026-09-28: "semana ISO, segunda a
// domingo"). Mesmo criterio de filtro-mes.ts, so calculando a semana em
// vez do mes.
export function filtroSemana(periodo: string): { gte: Date; lte: Date } {
  const match = /^(\d{4})-W(\d{2})$/.exec(periodo);
  if (!match) {
    throw new Error(`Periodo semanal invalido: '${periodo}' (esperado "YYYY-Www")`);
  }
  const ano = Number(match[1]);
  const semana = Number(match[2]);

  // Algoritmo padrao ISO-8601: o dia 4 de janeiro SEMPRE cai na semana 1 -
  // a segunda-feira dessa semana e' o ponto de partida, dali soma
  // (semana - 1) * 7 dias.
  const quatroDeJaneiro = new Date(Date.UTC(ano, 0, 4));
  const diaSemanaIso = quatroDeJaneiro.getUTCDay() || 7; // domingo (0) -> 7
  const segundaSemana1 = new Date(quatroDeJaneiro);
  segundaSemana1.setUTCDate(quatroDeJaneiro.getUTCDate() - diaSemanaIso + 1);

  const gte = new Date(segundaSemana1);
  gte.setUTCDate(segundaSemana1.getUTCDate() + (semana - 1) * 7);
  gte.setUTCHours(0, 0, 0, 0);

  const lte = new Date(gte);
  lte.setUTCDate(gte.getUTCDate() + 6);
  lte.setUTCHours(23, 59, 59, 999);

  return { gte, lte };
}

// "YYYY-Www" da semana ISO atual - mesmo formato de <input type="week">,
// default de periodo (periodicidade SEMANAL) em toda consulta, mesmo
// papel de mesAnoAtual() do lado mensal.
export function semanaIsoAtual(): string {
  const agora = new Date();
  const dataAlvo = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  const diaSemanaIso = dataAlvo.getUTCDay() || 7;
  // Quinta-feira da mesma semana ISO - o ANO dela e' o ano ISO correto
  // (cobre o caso de semana 1 de janeiro pertencer ao fim do ano anterior,
  // ou semana 52/53 de dezembro pertencer ao ano seguinte).
  dataAlvo.setUTCDate(dataAlvo.getUTCDate() + 4 - diaSemanaIso);
  const anoIso = dataAlvo.getUTCFullYear();
  const primeiroDeJaneiro = new Date(Date.UTC(anoIso, 0, 1));
  const numeroSemana = Math.ceil(((dataAlvo.getTime() - primeiroDeJaneiro.getTime()) / 86400000 + 1) / 7);
  return `${anoIso}-W${String(numeroSemana).padStart(2, '0')}`;
}
