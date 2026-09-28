// Formatação compartilhada por qualquer tela que exiba valor monetário ou
// data vinda da API (produtos, pedidos, ...) - não duplicar por tela.
export function formatarMoeda(valor: string | null): string {
  if (valor === null) {
    return "—";
  }
  const numero = Number(valor);
  if (Number.isNaN(numero)) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numero);
}

// Epico 1.1 (cards de KPI do painel) - quantidade inteira com separador de
// milhar pt-BR (ex: 1.377), sem casas decimais.
export function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

export function formatarData(valorIso: string | null): string {
  if (valorIso === null) {
    return "—";
  }
  const data = new Date(valorIso);
  if (Number.isNaN(data.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(data);
}

// OS-novas-implementacoes.md Bloco 3 - peso por produto/pedido (Decimal do
// Prisma chega como string, mesmo padrão de formatarMoeda acima).
export function formatarPeso(valorKg: string | null): string {
  if (valorKg === null) {
    return "—";
  }
  const numero = Number(valorKg);
  if (Number.isNaN(numero)) {
    return "—";
  }
  return `${new Intl.NumberFormat("pt-BR").format(numero)} kg`;
}

// Estoque (soma de lotes, disponivel, quantidade por lote) - Decimal do
// Prisma/WK BI chega como string com ponto decimal e ate 4 casas fixas
// (ex: "240.8000") - exibir cru confundiria usuario BR, que le ponto como
// separador de MILHAR ("240.8000" pareceria "240800,0", 1000x maior que o
// valor real). new Intl.NumberFormat("pt-BR") converte pro formato
// correto (virgula decimal) e corta zero a direita sem significado
// (240.8000 -> "240,8").
export function formatarQuantidade(valor: string | null): string {
  if (valor === null) {
    return "—";
  }
  const numero = Number(valor);
  if (Number.isNaN(numero)) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(numero);
}

// Listagem de lotes (estoque-resultado-view) - pedido do usuário
// (2026-09-28): sempre 3 casas decimais, mesmo com zero à direita (0,9 ->
// "0,900", 15,3 -> "15,300"), diferente de formatarQuantidade acima (que
// corta zeros à direita). Só essa tela - as outras usam formatarQuantidade
// normal.
export function formatarQuantidadeLote(valor: string | null): string {
  if (valor === null) {
    return "—";
  }
  const numero = Number(valor);
  if (Number.isNaN(numero)) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(numero);
}

// Contato de cliente (ContatoCliente.telefoneDdd/telefoneNumero) - "—"
// quando falta qualquer uma das duas partes (nunca mostra so DDD ou so
// numero solto).
export function formatarTelefone(ddd: string | null, numero: string | null): string {
  if (!ddd || !numero) {
    return "—";
  }
  return `(${ddd}) ${numero}`;
}

// Criação de pedido (popup de item/resumo do pedido) - valor ja em
// percentual (ex: 10 -> "10%"), nao fracao (0.1).
export function formatarPercentual(valor: number, casasDecimais = 2): string {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: casasDecimais })}%`;
}

export function formatarDataHora(valorIso: string | null): string {
  if (valorIso === null) {
    return "—";
  }
  const data = new Date(valorIso);
  if (Number.isNaN(data.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}
