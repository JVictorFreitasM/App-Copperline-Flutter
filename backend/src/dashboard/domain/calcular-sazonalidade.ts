// OS-BACKEND-49 - calculo deterministico (NAO-IA) da serie mensal de
// vendas de um produto e da variacao mes atual vs mesmo mes do ano
// anterior. A IA (ver sazonalidade.service.ts) so' entra depois, pra
// transformar esses numeros ja calculados em texto - nunca decide o
// calculo em si (auditavel independente de qualquer chamada de IA, ver
// criterio de aceite da OS).
export interface VendaBruta {
  data: Date;
  valor: number;
}

export interface VendaMensal {
  mesAno: string;
  valorVendido: number;
}

// "YYYY-MM" em UTC - mesmo criterio ja usado em metas/filtro-mes.ts
// (OS-BACKEND-44), evita depender do fuso horario do processo Node.
function paraMesAno(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

// Janela fixa de 13 meses (mes atual + 12 anteriores) - o suficiente pra
// exibir "ultimos 12+ meses" (criterio de aceite da OS) E pra sempre ter o
// "mesmo mes do ano anterior" disponivel pra comparacao, sem precisar de
// uma segunda consulta.
export function gerarSerieMensal(
  vendas: VendaBruta[],
  hoje: Date,
  mesesJanela = 13,
): VendaMensal[] {
  const totalPorMes = new Map<string, number>();
  for (const venda of vendas) {
    const chave = paraMesAno(venda.data);
    totalPorMes.set(chave, (totalPorMes.get(chave) ?? 0) + venda.valor);
  }

  const serie: VendaMensal[] = [];
  for (let i = mesesJanela - 1; i >= 0; i--) {
    const referencia = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1),
    );
    const mesAno = paraMesAno(referencia);
    serie.push({ mesAno, valorVendido: totalPorMes.get(mesAno) ?? 0 });
  }
  return serie;
}

// Percentual de variacao do mes atual (ultimo item da serie) contra o
// mesmo mes do ano anterior (13 meses atras na janela padrao) - null
// quando nao ha base de comparacao (ano anterior sem nenhuma venda), pra
// nunca devolver um percentual "infinito"/inventado disfarcado de numero.
export function calcularVariacaoAnoAnterior(serie: VendaMensal[]): number | null {
  if (serie.length < 13) {
    return null;
  }
  const atual = serie[serie.length - 1];
  const anoAnterior = serie[serie.length - 13];
  if (anoAnterior.valorVendido === 0) {
    return null;
  }
  return (
    ((atual.valorVendido - anoAnterior.valorVendido) / anoAnterior.valorVendido) * 100
  );
}
