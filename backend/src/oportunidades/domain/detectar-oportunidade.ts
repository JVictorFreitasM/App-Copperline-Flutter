// OS-BACKEND-45 - regra determinística (NAO-IA) que decide QUEM entra na
// lista de oportunidades. A IA (ver oportunidade-cliente.service.ts) so
// entra depois, pra gerar uma frase de contexto a partir do motivo ja
// calculado aqui - nunca decide sozinha quem aparece (evita alucinacao de
// prioridade, ver criterio de aceite da OS). Funcoes puras, sem Prisma/
// HTTP - testáveis isoladamente (ver skill nest-endpoint, criterio de DDD:
// modulo com decisao real de negocio).
export type MotivoOportunidade =
  | { tipo: 'SEM_PEDIDO_HA_DIAS'; dias: number }
  | { tipo: 'ANIVERSARIO_RELACIONAMENTO'; anos: number }
  | {
      tipo: 'RECOMPRA_PROXIMA';
      produtoId: string;
      intervaloMedioDias: number;
      diasDesdeUltimaCompra: number;
    };

export interface CompraProduto {
  produtoId: string;
  data: Date;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function diferencaDias(de: Date, ate: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / MS_POR_DIA);
}

// Cliente sem pedido ha N dias - o candidato mais simples e mais barato de
// calcular (so precisa da data do ultimo pedido).
export function detectarSemPedidoHaDias(
  ultimoPedidoEm: Date | null,
  hoje: Date,
  limiarDias: number,
): MotivoOportunidade | null {
  if (!ultimoPedidoEm) {
    return null;
  }
  const dias = diferencaDias(ultimoPedidoEm, hoje);
  return dias >= limiarDias ? { tipo: 'SEM_PEDIDO_HA_DIAS', dias } : null;
}

// Aniversario de relacionamento comercial (data do primeiro pedido) - janela
// de alguns dias em vez de exigir o dia EXATO (o vendedor precisa de tempo
// pra agir, nao so no dia certo) - considera o aniversario mais proximo
// (deste ano, do anterior ou do seguinte, cobre a virada de ano).
export function detectarAniversarioRelacionamento(
  primeiroPedidoEm: Date | null,
  hoje: Date,
  janelaDias = 3,
): MotivoOportunidade | null {
  if (!primeiroPedidoEm) {
    return null;
  }
  const anos = hoje.getFullYear() - primeiroPedidoEm.getFullYear();
  if (anos < 1) {
    return null;
  }

  const candidatos = [-1, 0, 1].map(
    (deltaAno) =>
      new Date(
        hoje.getFullYear() + deltaAno,
        primeiroPedidoEm.getMonth(),
        primeiroPedidoEm.getDate(),
      ),
  );
  const distanciaMinima = Math.min(
    ...candidatos.map((candidato) => Math.abs(diferencaDias(candidato, hoje))),
  );

  return distanciaMinima <= janelaDias
    ? { tipo: 'ANIVERSARIO_RELACIONAMENTO', anos }
    : null;
}

// Recompra proxima do intervalo esperado - so considera produto comprado
// pelo menos 2x (precisa de ao menos 1 intervalo real pra estimar
// periodicidade, nunca inventar um numero sem base). Tolerancia (80% a
// 130% do intervalo medio) pra nao exigir o dia exato - cliente que compra
// "mais ou menos a cada 45 dias" nao bate certinho toda vez.
export function detectarRecompraProxima(
  compras: CompraProduto[],
  hoje: Date,
  toleranciaMinima = 0.8,
  toleranciaMaxima = 1.3,
): MotivoOportunidade | null {
  const datasPorProduto = new Map<string, Date[]>();
  for (const compra of compras) {
    const lista = datasPorProduto.get(compra.produtoId) ?? [];
    lista.push(compra.data);
    datasPorProduto.set(compra.produtoId, lista);
  }

  for (const [produtoId, datas] of datasPorProduto) {
    if (datas.length < 2) {
      continue;
    }
    const ordenadas = [...datas].sort((a, b) => a.getTime() - b.getTime());
    const intervalos: number[] = [];
    for (let i = 1; i < ordenadas.length; i++) {
      intervalos.push(diferencaDias(ordenadas[i - 1], ordenadas[i]));
    }
    const intervaloMedio =
      intervalos.reduce((soma, valor) => soma + valor, 0) / intervalos.length;
    const diasDesdeUltimaCompra = diferencaDias(
      ordenadas[ordenadas.length - 1],
      hoje,
    );

    if (
      diasDesdeUltimaCompra >= intervaloMedio * toleranciaMinima &&
      diasDesdeUltimaCompra <= intervaloMedio * toleranciaMaxima
    ) {
      return {
        tipo: 'RECOMPRA_PROXIMA',
        produtoId,
        intervaloMedioDias: Math.round(intervaloMedio),
        diasDesdeUltimaCompra,
      };
    }
  }
  return null;
}
